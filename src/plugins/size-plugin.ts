import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { dtsExtensionRegex } from '../constants'
import { paint } from '../logger'
import { Entries } from '../types'

type Pair = [string, string, number]
type SizeStats = Map<string, Pair[]>

function createChunkSizeCollector({ entries }: { entries: Entries }): {
  plugin(cwd: string): Plugin
  getSizeStats(): SizeStats
} {
  const sizeStats: SizeStats = new Map()

  function addSize({
    fileName,
    size,
    sourceFileName,
    exportPath,
  }: {
    fileName: string
    size: number
    sourceFileName: string
    exportPath: string
  }) {
    if (!sizeStats.has(exportPath)) {
      sizeStats.set(exportPath, [])
    }
    const distFilesStats = sizeStats.get(exportPath)
    if (distFilesStats) {
      distFilesStats.push([fileName, sourceFileName, size])
    }
  }

  const reversedMapping = new Map<string, string>()
  Object.entries(entries).forEach(([, entry]) => {
    reversedMapping.set(entry.source, entry.name || '.')
  })

  return {
    plugin: (cwd: string) => {
      return {
        name: 'collect-sizes',
        writeBundle(options, bundle) {
          const dir = options.dir || path.dirname(options.file!)
          Object.entries(bundle).forEach(([fileName, chunk]) => {
            const filePath = path.join(dir, fileName)
            if (chunk.type !== 'chunk') {
              return
            }
            const size = chunk.code.length
            const sourceFileName = chunk.facadeModuleId || ''
            const exportPath = reversedMapping.get(sourceFileName) || '.'
            addSize({
              fileName: path.isAbsolute(cwd)
                ? path.relative(cwd, filePath)
                : filePath,
              size,
              sourceFileName,
              exportPath,
            })
          })
        }
      }
    },
    getSizeStats() {
      return sizeStats
    },
  }
}

function logSizeStats(sizeCollector: ReturnType<typeof createChunkSizeCollector>) {
  const stats = sizeCollector.getSizeStats()
  const allFileNameLengths = Array.from(stats.values()).flat(1).map(([filename]) => filename.length)
  const maxLength = Math.max(...allFileNameLengths)

  ;[...stats.entries()]
  .sort(([a], [b]) => a.length - b.length)
  .forEach(([, filesList]) => {
    filesList.forEach((item: Pair) => {
      const [filename, , size] = item
      const padding = ' '.repeat(maxLength - filename.length)
      const isTypeFile = dtsExtensionRegex.test(filename)
      const action = isTypeFile ? '[types]' : '[chunk]'
      const prettiedSize = prettyBytes(size)
      paint('  ' + action, isTypeFile ? 'blue' : 'white', `${filename}${padding}  - ${prettiedSize}`)
    })
  })
}

type PluginContext = {
  sizeCollector: ReturnType<typeof createChunkSizeCollector>
  moduleDirectiveLayerMap: Map<string, Set<[string, string]>>
  entriesAlias: Record<string, string>
}

export {
  logSizeStats,
  createChunkSizeCollector,
  type PluginContext,
}
