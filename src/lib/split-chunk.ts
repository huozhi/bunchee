import { type CustomPluginOptions } from 'rollup'
import path from 'path'
import { availableExtensions } from '../constants'

export function getModuleLayer(moduleMeta: CustomPluginOptions) {
  const directives = (
    moduleMeta.preserveDirectives || { directives: [] }
  ).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  const moduleLayer = directives[0]
  return moduleLayer
}

export function getCustomModuleLayer(moduleId: string): string | undefined {
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
