import type { Plugin } from 'rollup'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import pc from 'picocolors'
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

function isTypeFile(filename: string) {
  return filename.endsWith('.d.ts') || filename.endsWith('.d.mts') || filename.endsWith('.d.cts')
}

function normalizeExportName(exportName: string): string {
  const isBinary = isBin(exportName)
  let result = exportName
  
  const isSubpathExport = exportName.includes('/')
  const isSpecialExport = exportName.includes('.')
  if (isBinary) {
    result = ((exportName.replace(/bin(\/|$)/, '') || '.') + ' (bin)')
  } else if (isSubpathExport || isSpecialExport) {
    const subExportName: string | undefined = exportName.split('/')[1] || exportName
    if (subExportName.includes('.') && subExportName !== '.') {
      const [originExportName, specialCondition] = subExportName.split('.')
      result = (isSubpathExport ? originExportName : '.') + ' (' + specialCondition + ')'
    } else {
      result =  isSubpathExport ? ('./' + subExportName) : '.'
    }
  } else {
    result = '.'
  }
  return result
}

function getExportNameWithoutExportCondition(exportName: string): string {
  return exportName.includes('.') ? exportName.split('.')[0] : exportName
}

function logOutputState(sizeCollector: ReturnType<typeof createOutputState>) {
  const stats = sizeCollector.getSizeStats()
  const allFileNameLengths = Array.from(stats.values()).flat(1).map(([filename]) => filename.length)
  const maxFilenameLength = Math.max(...allFileNameLengths)
  const statsArray = [...stats.entries()]
    .sort(([a], [b]) => {
      const comp = (getExportNameWithoutExportCondition(a).length - getExportNameWithoutExportCondition(b).length)
      return comp === 0 ? a.localeCompare(b) : comp
    })
  
  const maxLengthOfExportName = Math.max(...statsArray.map(([exportName]) => normalizeExportName(exportName).length))
  console.log(
    pc.underline('Exports'), ' '.repeat(Math.max(maxLengthOfExportName - 'Exports'.length, 0)), 
    pc.underline('File'), ' '.repeat(Math.max(maxFilenameLength - 'File'.length, 0)), 
    pc.underline('Size')
  )

  statsArray.forEach(([exportName, filesList]) => {
    // sort by file type, first js files then types, js/mjs/cjs are prioritized than .d.ts/.d.mts/.d.cts
    filesList.sort(
      ([a], [b]) => {
        const aIsType = isTypeFile(a)
        const bIsType = isTypeFile(b)
        if (aIsType && bIsType) {
          return 0
        }
        if (aIsType) {
          return 1
        }
        if (bIsType) {
          return -1
        }
        return 0
      }
    ).forEach((item: Pair, index) => {
      const [filename, , size] = item
      const normalizedExportName = normalizeExportName(exportName) 
      const prefix = index === 0 
        ? normalizedExportName + ' '.repeat(maxLengthOfExportName - normalizedExportName.length) 
        : ' '.repeat(maxLengthOfExportName)
      
      const sizePadding = ' '.repeat(maxFilenameLength - filename.length)
      const prettiedSize = prettyBytes(size)
      const isType = isTypeFile(filename)

      console.log(` ${prefix} ${pc[isType ? 'dim' : 'bold'](filename)}${sizePadding}  ${prettiedSize}`)
    })
  })
}

export {
  logOutputState,
  createOutputState,
  type PluginContext,
}
