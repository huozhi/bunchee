import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { dtsExtensionRegex } from '../constants'
import { logger } from '../logger'

type SizeStats = [string, string, number][]

function createChunkSizeCollector(): {
  plugin(cwd: string): Plugin
  getSizeStats(): SizeStats
} {
  const sizes: Map<string, number> = new Map()

  function addSize(name: string, size: number) {
    sizes.set(name, size)
  }

  return {
    plugin: (cwd: string) => {
      return {
        name: 'collect-sizes',
        augmentChunkHash() {
          // Do nothing, but use the hook to keep the plugin instance alive
        },
        renderChunk(code, chunk, options) {
          const dir =
            options.dir || (options.file && path.dirname(options.file))
          let fileName = chunk.fileName
          if (dir) {
            const filePath = path.join(dir, fileName)
            fileName = filePath.startsWith(cwd)
              ? path.relative(cwd, filePath)
              : filePath
          }
          addSize(fileName, code.length)
          return null
        },
      }
    },
    getSizeStats() {
      const sizeStats: SizeStats = []
      sizes.forEach((size, name) => {
        sizeStats.push([name, prettyBytes(size), size])
      })
      return sizeStats
    },
  }
}

// This can also be passed down as stats from top level
const sizeCollector = createChunkSizeCollector()

function logSizeStats() {
  const stats = sizeCollector.getSizeStats()
  const maxLength = Math.max(...stats.map(([filename]) => filename.length))
  stats.forEach(([filename, prettiedSize]) => {
    const padding = ' '.repeat(maxLength - filename.length)
    const action = dtsExtensionRegex.test(filename) ? 'Typed' : 'Built'
    logger.info(`${action} ${filename}${padding} - ${prettiedSize}`)
  })
}

export { logSizeStats, sizeCollector, createChunkSizeCollector }
