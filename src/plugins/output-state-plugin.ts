import type { Plugin } from 'rollup'
import { type Entries } from '../types'
import path from 'path'
import prettyBytes from 'pretty-bytes'
import pc from 'picocolors'
import { logger } from '../logger'
import { BINARY_TAG } from '../constants'
import {
  getSpecialExportTypeFromComposedExportPath,
  normalizeExportPath,
} from '../entries'
import {
  isBinExportPath,
  isPrivateExportPath,
  isTypeFile,
  normalizePath,
} from '../utils'

// [filename, sourceFileName, size]
type FileState = [string, string, number]
type SizeStats = Map<string, FileState[]>
export type OutputState = ReturnType<typeof createOutputState>

// Example: @foo/bar -> bar
const removeScope = (exportPath: string) => exportPath.replace(/^@[^/]+\//, '')

function createOutputState({ entries }: { entries: Entries }): {
  plugin(cwd: string): Plugin
  getSizeStats(): SizeStats
} {
  const sizeStats: SizeStats = new Map()
  const uniqFiles = new Set<string>()

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
    if (!uniqFiles.has(fileName)) {
      uniqFiles.add(fileName)
      if (distFilesStats) {
        distFilesStats.push([fileName, sourceFileName, size])
      }
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
            if (!chunk.isEntry) {
              return
            }
            const size = chunk.code.length
            const sourceFileName = chunk.facadeModuleId || ''
            const exportPath = removeScope(
              reversedMapping.get(sourceFileName) || '.',
            )
            addSize({
              fileName: normalizePath(path.relative(cwd, filePath)),
              size,
              sourceFileName: normalizePath(sourceFileName),
              exportPath,
            })
          })
        },
      }
    },
    getSizeStats() {
      return sizeStats
    },
  }
}

function normalizeExportName(exportName: string): string {
  const isBinary = isBinExportPath(exportName)
  let result = exportName

  if (isBinary) {
    result =
      (exportName.replace(new RegExp(`^\\${BINARY_TAG}\\/?`), '') || '.') +
      ' (bin)'
  } else {
    const normalizedExportPath = normalizeExportPath(exportName)
    const specialConditionName =
      getSpecialExportTypeFromComposedExportPath(exportName)

    result =
      normalizedExportPath +
      (specialConditionName !== 'default' ? ` (${specialConditionName})` : '')
  }
  return result
}

function logOutputState(stats: SizeStats) {
  if (stats.size === 0) {
    logger.warn('No build info can be logged')
    return
  }

  const allFileNameLengths = Array.from(stats.values())
    .flat(1)
    .map(([filename]) => filename.length)
  const maxFilenameLength = Math.max(...allFileNameLengths)
  const statsArray = [...stats.entries()]
    // filter out empty file states.
    // e.g. if you're building a file that does not listed in the exports, or there's no exports condition.
    .filter(([, fileStates]) => fileStates.length > 0)
    .sort(([a], [b]) => {
      const comp = normalizeExportPath(a).length - normalizeExportPath(b).length
      return comp === 0 ? a.localeCompare(b) : comp
    })

  const maxLengthOfExportName = Math.max(
    ...statsArray.map(([exportName]) => normalizeExportName(exportName).length),
  )
  console.log(
    pc.underline('Exports'),
    ' '.repeat(Math.max(maxLengthOfExportName - 'Exports'.length, 0)),
    pc.underline('File'),
    ' '.repeat(Math.max(maxFilenameLength - 'File'.length, 0)),
    pc.underline('Size'),
  )

  statsArray.forEach(([exportName, filesList]) => {
    // sort by file type, first js files then types, js/mjs/cjs are prioritized than .d.ts/.d.mts/.d.cts
    filesList
      .sort(([a], [b]) => {
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
      })
      .forEach((item: FileState, index) => {
        const [filename, , size] = item
        const normalizedExportName = normalizeExportName(exportName)

        const exportNameWithPadding =
          index === 0
            ? // Each exports, only show the export path in the first item.
              // For other formats, just show the padding spaces.
              normalizedExportName
            : ' '.repeat(normalizedExportName.length)
        const filenamePadding = ' '.repeat(
          Math.max(maxLengthOfExportName, 'Exports'.length) -
            normalizedExportName.length,
        )
        const isType = isTypeFile(filename)

        const prettiedSize = prettyBytes(size)
        const sizePadding = ' '.repeat(
          Math.max(maxFilenameLength, 'File'.length) - filename.length,
        )

        // Logging shared in debug mode
        if (isPrivateExportPath(exportName)) {
          if (index === 0 && process.env.DEBUG) {
            const label = '(chunk)'
            const sizePadding = ' '.repeat(
              Math.max(maxFilenameLength, 'File'.length) - label.length,
            )
            console.log(
              pc.dim(normalizeExportName(exportName)),
              filenamePadding,
              pc.dim(label),
              sizePadding,
              pc.dim(prettiedSize),
            )
          }
          return
        }

        console.log(
          exportNameWithPadding,
          filenamePadding,
          `${pc[isType ? 'dim' : 'bold'](filename)}`,
          sizePadding,
          prettiedSize,
        )
      })
  })
}

export { logOutputState, createOutputState }
