import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import { paint } from '../logger'
import { Entries } from '../types'

type Pair = [string, string, number]
type SizeStats = Map<string, Pair[]>
type PluginContext = {
  outputState: ReturnType<typeof createOutputState>
  moduleDirectiveLayerMap: Map<string, Set<[string, string]>>
  entriesAlias: Record<string, string>
}

function createOutputState({ entries }: { entries: Entries }): {
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
  Object.entries(entries).forEach(([resolvedExportName, entry]) => {
    reversedMapping.set(entry.source, resolvedExportName)
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

function isBin(filename: string) {
  return filename === 'bin' || filename.startsWith('bin/')
}

function logOutputState(sizeCollector: ReturnType<typeof createOutputState>) {
  const stats = sizeCollector.getSizeStats()
  const allFileNameLengths = Array.from(stats.values()).flat(1).map(([filename]) => filename.length)
  const maxLength = Math.max(...allFileNameLengths)

  const statsArray = [...stats.entries()]
    .sort(([a], [b]) => a.length - b.length)
  
  const maxLengthOfExportName = Math.max(...statsArray.map(([exportName]) => exportName.length))
  statsArray.forEach(([exportName, filesList]) => {
    filesList.forEach((item: Pair, index) => {
      const [filename, , size] = item
      const normalizedPrefix = isBin(exportName) 
        ? exportName.replace('bin/', '') 
        : exportName.includes('/')
          ? ('/' + exportName.split('/')[1])
          : exportName
      const prefix = index === 0 
        ? normalizedPrefix + ' '.repeat(maxLengthOfExportName - normalizedPrefix.length) 
        : ' '.repeat(maxLengthOfExportName)
      
      const sizePadding = ' '.repeat(maxLength - filename.length)
      const prettiedSize = prettyBytes(size)
      const isBinary = isBin(exportName)
      paint(prefix, isBinary ? 'yellow' : 'blue', `${filename}${sizePadding}  - ${prettiedSize}`)
    })
  })
}

export {
  logOutputState,
  createOutputState,
  type PluginContext,
}
