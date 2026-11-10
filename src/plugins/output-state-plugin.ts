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
const SHARED_CHUNKS = '$chunks'
const ASSETS = '$assets'
export type SizeStats = Map<string, FileState[]>
export type OutputState = ReturnType<typeof createOutputState>

// Example: @foo/bar -> bar
const removeScope = (exportPath: string) => exportPath.replace(/^@[^/]+\//, '')

function createOutputState({ entries }: { entries: Entries }): {
  plugin(cwd: string): Plugin
  getSizeStats(): SizeStats
  mergeSizeStats(other: SizeStats): void
} {
  const sizeStats: SizeStats = new Map()
  const filesByName = new Map<string, FileState>()

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
    const existing = filesByName.get(fileName)
    if (existing) {
      existing[1] = sourceFileName
      existing[2] = size
      return
    }
    if (!sizeStats.has(exportPath)) {
      sizeStats.set(exportPath, [])
    }
    const fileState: FileState = [fileName, sourceFileName, size]
    filesByName.set(fileName, fileState)
    sizeStats.get(exportPath)!.push(fileState)
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
            const sourceFileName =
              chunk.type === 'chunk' ? chunk.facadeModuleId || '' : ''
            const source = chunk.type === 'chunk' ? chunk.code : chunk.source
            const size =
              typeof source === 'string'
                ? Buffer.byteLength(source)
                : source.byteLength
            const exportPath =
              chunk.type === 'asset'
                ? ASSETS
                : chunk.isEntry
                  ? removeScope(reversedMapping.get(sourceFileName) || '.')
                  : SHARED_CHUNKS
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
    mergeSizeStats(other: SizeStats) {
      for (const [exportPath, fileStates] of other) {
        for (const [fileName, sourceFileName, size] of fileStates) {
          addSize({ fileName, sourceFileName, size, exportPath })
        }
      }
    },
  }
}

function normalizeExportName(exportName: string): string {
  if (exportName === SHARED_CHUNKS) return 'Shared chunks'
  if (exportName === ASSETS) return 'Assets'
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
      const groupOrder = (name: string) =>
        name === ASSETS ? 2 : name === SHARED_CHUNKS ? 1 : 0
      const order = groupOrder(a) - groupOrder(b)
      if (order !== 0) return order
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
  const files = statsArray.flatMap(([, fileStates]) => fileStates)
  const totalBytes = files.reduce((total, [, , size]) => total + size, 0)
  console.log(
    `Total: ${prettyBytes(totalBytes)} in ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
  )
}

export { logOutputState, createOutputState }
