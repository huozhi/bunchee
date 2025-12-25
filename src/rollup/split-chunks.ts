import { type GetManualChunk, type GetModuleInfo } from 'rollup'
import { type CustomPluginOptions } from 'rollup'
import path from 'path'
import { memoize } from '../lib/memoize'

const hashTo3Char = memoize((input: string): string => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i) // Simple hash shift
  }
  return (hash >>> 0).toString(36).slice(0, 3) // Base36 + trim to 3 chars
})

function getModuleLayer(moduleMeta: CustomPluginOptions): string | undefined {
  const directives = (
    moduleMeta.preserveDirectives || { directives: [] }
  ).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  const moduleLayer = directives[0]
  return moduleLayer ? hashTo3Char(moduleLayer) : undefined
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
): GetManualChunk {
  // If there's existing chunk being splitted, and contains a layer { <id>: <chunkGroup> }
  const splitChunksGroupMap = new Map<string, string>()

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

        const chunkName = path.basename(id, path.extname(id))
        // Create a unique suffix based on all the layers that import this module
        const layersSuffix = Array.from(importerLayers).sort().join('-')
        const chunkGroup = `${chunkName}-${hashTo3Char(layersSuffix)}`

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
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

        const chunkName = path.basename(id, path.extname(id))
        const layerSuffix = hashTo3Char(moduleLayer)
        const chunkGroup = `${chunkName}-${layerSuffix}`

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
    }
    return
  }
}
