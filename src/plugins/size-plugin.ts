import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'

type SizeStats = [string, string, number][]

function chunkSizeCollector(): {
  plugin(cwd: string): Plugin,
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
          const dir = options.dir || (options.file && path.dirname(options.file))
          let fileName = chunk.fileName
          if (dir) {
            const filePath = path.join(dir, fileName)
            fileName = filePath.startsWith(cwd) ? path.relative(cwd, filePath) : filePath
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

export default chunkSizeCollector
