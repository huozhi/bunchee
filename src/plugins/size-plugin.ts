import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { dtsExtensionRegex } from '../constants'
import { logger } from '../logger'
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
  Object.entries(entries).forEach(([exportPath, entry]) => {
    reversedMapping.set(entry.source, entry.name)
  })

  return {
    plugin: (cwd: string) => {
      return {
        name: 'collect-sizes',
        augmentChunkHash() {
          // Do nothing, but use the hook to keep the plugin instance alive
        },
        renderChunk(code, chunk, options) {
          const sourceId = chunk.facadeModuleId!

          const dir =
            options.dir || (options.file && path.dirname(options.file))
          let fileName = chunk.fileName
          if (dir) {
            const filePath = path.join(dir, fileName)
            fileName = filePath.startsWith(cwd)
              ? path.relative(cwd, filePath)
              : filePath
          }
          addSize({
            fileName,
            size: code.length,
            sourceFileName: sourceId,
            exportPath: reversedMapping.get(sourceId)!,
          })
          return null
        },
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
  const maxLength = Math.max(...allFileNameLengths) + 1


  ;[...stats.entries()]
  .sort(([a], [b]) => a.length - b.length)
  .forEach(([exportPath, filesList]) => {
    logger.prefixedLog('■', exportPath)
    filesList.forEach((item: Pair) => {
      const [filename, , size] = item
      const padding = ' '.repeat(maxLength - filename.length)
      const action = dtsExtensionRegex.test(filename) ? 'Typed' : 'Built'
      const prettiedSize = prettyBytes(size)
      logger.log(`${action} ${filename}${padding} - ${prettiedSize}`)
    })
  })
}

type PluginContext = {
  sizeCollector: ReturnType<typeof createChunkSizeCollector>
}

export {
  logSizeStats,
  createChunkSizeCollector,
  type PluginContext,
}
