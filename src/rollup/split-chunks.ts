import { type GetManualChunk, type GetModuleInfo } from 'rollup'
import { type CustomPluginOptions } from 'rollup'
import path from 'path'

/**
 * The module's own directive layer, as written — `'use client'` gives `client`.
 *
 * This is the raw directive rather than a hash of it. The value decides whether
 * two modules sit on the same side of a boundary, so it has to stay exact: a
 * hash short enough to put in a file name is not, and `'use server'` and
 * `'use cache'` collided under the one that used to be here.
 */
function getModuleLayer(moduleMeta: CustomPluginOptions): string | undefined {
  const directives = (
    moduleMeta.preserveDirectives || { directives: [] }
  ).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  return directives[0]
}

/**
 * Get the effective layer of a module by walking up the importer chain.
 * A module inherits the layer of its importer if it doesn't have its own layer.
 */
function getEffectiveModuleLayer(
  id: string,
  getModuleInfo: GetModuleInfo,
  visited: Set<string> = new Set(),
): string | undefined {
  if (visited.has(id)) {
    return undefined
  }
  visited.add(id)

  const moduleInfo = getModuleInfo(id)
  if (!moduleInfo) {
    return undefined
  }

  // If this module has its own layer, return it
  const ownLayer = getModuleLayer(moduleInfo.meta)
  if (ownLayer) {
    return ownLayer
  }

  // Otherwise, inherit layer from importers
  for (const importerId of moduleInfo.importers) {
    const importerLayer = getEffectiveModuleLayer(
      importerId,
      getModuleInfo,
      visited,
    )
    if (importerLayer) {
      return importerLayer
    }
  }

  return undefined
}

/**
 * Check if a module is imported by modules with different boundary layers.
 * Returns the set of unique layers if there are multiple, otherwise undefined.
 */
function getImporterLayers(
  id: string,
  getModuleInfo: GetModuleInfo,
): Set<string> {
  const moduleInfo = getModuleInfo(id)
  if (!moduleInfo) {
    return new Set()
  }

  const layers = new Set<string>()

  for (const importerId of moduleInfo.importers) {
    const importerInfo = getModuleInfo(importerId)
    if (!importerInfo) {
      continue
    }

    // Get the importer's own layer first
    const importerOwnLayer = getModuleLayer(importerInfo.meta)
    if (importerOwnLayer) {
      layers.add(importerOwnLayer)
    } else {
      // If the importer doesn't have a layer, get its effective layer
      const effectiveLayer = getEffectiveModuleLayer(
        importerId,
        getModuleInfo,
        new Set([id]),
      )
      if (effectiveLayer) {
        layers.add(effectiveLayer)
      }
    }
  }

  return layers
}

// dependencyGraphMap: Map<subModuleId, Set<entryParentId>>
export function createSplitChunks(
  dependencyGraphMap: Map<string, Set<[string, string | undefined]>>,
  entryFiles: Set<string>,
  /**
   * One graph holding every entry only gets to place a directive module once,
   * where a build per entry decides separately each time — so it cannot inline
   * the module into a same-layer entry and split it out of a different-layer
   * one. Giving every directive module its own chunk keeps the boundary
   * explicit for all of them, and costs one chunk instead of a copy per entry.
   */
  merged: boolean = false,
  /**
   * Filled in as groups are created: group name -> the base name its file is
   * written under, for `chunkFileNames` to read back.
   *
   * A group name has to be layer-specific, or two modules that share a file
   * name on opposite sides of a boundary land in one chunk carrying both
   * directives. That makes the layer part of the key, but it is only a key —
   * it does not belong in the emitted file name, which stays
   * `<module>-<hash>`.
   */
  chunkBaseNames?: Map<string, string>,
): GetManualChunk {
  // If there's existing chunk being splitted, and contains a layer { <id>: <chunkGroup> }
  const splitChunksGroupMap = new Map<string, string>()

  /** module + layer -> group token, so the same pair always reuses its group. */
  const groupTokens = new Map<string, string>()

  /**
   * A group keyed by module *and* layer, written out under the module's name.
   *
   * The token is deliberately opaque rather than something readable like
   * `<module>_<layer>`: rollup rewrites a chunk name it considers unsafe for a
   * file name, and a rewritten name no longer matches the key it was recorded
   * under — which silently puts the layer back into the output. A token rollup
   * leaves alone keeps the emitted name entirely ours. It never reaches the
   * user; `chunkFileNames` maps it straight back to `base`.
   */
  function groupFor(id: string, layerKey: string): string {
    const base = path.basename(id, path.extname(id))
    const key = `${base}\u0000${layerKey}`
    let token = groupTokens.get(key)
    if (!token) {
      token = `bunchee_group_${groupTokens.size}`
      groupTokens.set(key, token)
      chunkBaseNames?.set(token, base)
    }
    return token
  }

  return function splitChunks(id, ctx) {
    if (/[\\/]node_modules[\\/]\@swc[\\/]helper/.test(id)) {
      return 'cc' // common chunk
    }

    const moduleInfo = ctx.getModuleInfo(id)
    if (!moduleInfo) {
      return
    }

    const { isEntry } = moduleInfo
    const moduleMeta = moduleInfo.meta
    const moduleLayer = getModuleLayer(moduleMeta)

    // Collect the sub modules of the entry, if they're having layer, and the same layer with the entry, push them to the dependencyGraphMap.
    if (isEntry) {
      const subModuleIds = ctx.getModuleIds()
      for (const subId of subModuleIds) {
        const subModuleInfo = ctx.getModuleInfo(subId)
        if (!subModuleInfo) {
          continue
        }

        const subModuleLayer = getModuleLayer(moduleMeta)
        if (subModuleLayer === moduleLayer) {
          if (!dependencyGraphMap.has(subId)) {
            dependencyGraphMap.set(subId, new Set())
          }
          dependencyGraphMap.get(subId)!.add([id, moduleLayer])
        }
      }
    }

    // Check if this module (without its own directive) is imported by multiple boundaries.
    // If so, split it into a separate shared chunk to prevent boundary crossing issues.
    if (!moduleLayer && !isEntry) {
      const importerLayers = getImporterLayers(id, ctx.getModuleInfo)

      // If this module is imported by modules with different layers (e.g., both client and server),
      // split it into a separate chunk that can be safely imported by both boundaries.
      if (importerLayers.size > 1) {
        if (splitChunksGroupMap.has(id)) {
          return splitChunksGroupMap.get(id)
        }

        // Keyed by every layer that reaches it, so the chunk shared by the
        // client and server boundaries is distinct from either one's own.
        const chunkGroup = groupFor(
          id,
          Array.from(importerLayers).sort().join('\u0000'),
        )

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
    }

    if (merged && moduleLayer && !isEntry) {
      const existing = splitChunksGroupMap.get(id)
      if (existing) return existing
      const chunkGroup = groupFor(id, moduleLayer)
      splitChunksGroupMap.set(id, chunkGroup)
      return chunkGroup
    }

    // If current module has a layer, and it's not an entry
    if (moduleLayer && !isEntry) {
      // If the module is imported by the entry:
      // when the module layer is same as entry layer, keep it as part of entry and don't split it;
      // when the module layer is different from entry layer, split the module into a separate chunk as a separate boundary.
      if (dependencyGraphMap.has(id)) {
        const parentModuleIds = Array.from(dependencyGraphMap.get(id)!)
        const isImportFromOtherEntry = parentModuleIds.some(([id]) => {
          // If other entry is dependency of this entry
          if (entryFiles.has(id)) {
            const entryModuleInfo = ctx.getModuleInfo(id)
            const entryModuleLayer = getModuleLayer(
              entryModuleInfo ? entryModuleInfo.meta : {},
            )
            return entryModuleLayer === moduleLayer
          }
          return false
        })
        if (isImportFromOtherEntry) return

        const isPartOfCurrentEntry = parentModuleIds.every(
          ([, layer]) => layer === moduleLayer,
        )
        if (isPartOfCurrentEntry) {
          if (splitChunksGroupMap.has(id)) {
            return splitChunksGroupMap.get(id)
          }
          return
        }

        const chunkGroup = groupFor(id, moduleLayer)

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
    }
    return
  }
}
