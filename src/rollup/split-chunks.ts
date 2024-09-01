import { type GetManualChunk } from 'rollup'
import { type CustomPluginOptions } from 'rollup'
import path from 'path'
import { availableExtensions } from '../constants'

function getModuleLayer(moduleMeta: CustomPluginOptions) {
  const directives = (
    moduleMeta.preserveDirectives || { directives: [] }
  ).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  const moduleLayer = directives[0]
  return moduleLayer
}

function getCustomModuleLayer(moduleId: string): string | undefined {
  const segments = path.basename(moduleId).split('.')
  if (segments.length >= 2) {
    const [layerSegment, ext] = segments.slice(-2)
    const baseName = segments[0]
    const match = layerSegment.match(/^(\w+)-runtime$/)
    const layer = match && match[1]
    if (availableExtensions.has(ext) && layer && layer.length > 0) {
      return baseName + '-' + layer
    }
  }
  return undefined
}

// dependencyGraphMap: Map<subModuleId, Set<entryParentId>>
export function createSplitChunks(
  dependencyGraphMap: Map<string, Set<[string, string]>>,
  entryFiles: Set<string>,
): GetManualChunk {
  // If there's existing chunk being splitted, and contains a layer { <id>: <chunkGroup> }
  const splitChunksGroupMap = new Map<string, string>()

  return function splitChunks(id, ctx) {
    const moduleInfo = ctx.getModuleInfo(id)
    if (!moduleInfo) {
      return
    }

    const { isEntry } = moduleInfo
    const moduleMeta = moduleInfo.meta
    const moduleLayer = getModuleLayer(moduleMeta)

    if (!isEntry) {
      const cachedCustomModuleLayer = splitChunksGroupMap.get(id)
      if (cachedCustomModuleLayer) return cachedCustomModuleLayer
      const customModuleLayer = getCustomModuleLayer(id)
      if (customModuleLayer) {
        splitChunksGroupMap.set(id, customModuleLayer)
        return customModuleLayer
      }
    }

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

    if (!isEntry) {
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
        const chunkGroup = `${chunkName}-${moduleLayer}`

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
    }
    return
  }
}
