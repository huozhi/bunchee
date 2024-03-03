import fs from 'fs'
import fsp from 'fs/promises'
import path, { join, posix } from 'path'
import { getExportTypeFromFile, type ParsedExportsInfo } from './exports'
import {
  PackageMetadata,
  type Entries,
  ExportPaths,
  // FullExportCondition,
} from './types'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  // findSourceEntryFile,
  getSourcePathFromExportPath,
  hasAvailableExtension,
  isTestFile,
  // joinRelativePath,
  resolveSourceFile,
} from './utils'
import {
  availableExtensions,
  BINARY_TAG,
  SRC,
  runtimeExportConventions,
  specialExportConventions,
} from './constants'
import { relativify } from './lib/format'

// shared.ts -> ./shared
// shared.<export condition>.ts -> ./shared
// index.ts -> ./index
// index.development.ts -> ./index.development
function sourceFilenameToExportPath(filename: string) {
  const baseName = baseNameWithoutExtension(filename)
  let exportPath = baseName
  for (const specialExportType of runtimeExportConventions) {
    // if (exportPath.endsWith('.' + specialExportType)) {
    //   exportPath = exportPath.slice(0, -1 - specialExportType.length)
    //   break
    // }
  }

  return relativify(exportPath)
}

export async function collectEntriesFromParsedExports(
  pkg: PackageMetadata,
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
  sourceFile: string | undefined,
): Promise<Entries> {
  const entries: Entries = {}
  if (sourceFile) {
    const defaultExport = parsedExportsInfo.get('.')![0]
    entries['.'] = {
      source: sourceFile,
      name: '.',
      export: {
        default: defaultExport[0],
      },
    }
  }

  // Find source files
  const { bins, exportsEntries } = await collectSourceEntries(join(cwd, SRC))
  // Traverse source files and try to match the entries
  // Find exports from parsed exports info
  // exportPath can be: '.', './index.development', etc.
  for (const [exportPath, sourceFilesMap] of exportsEntries) {
    const normalizedExportPath = normalizeExportPath(exportPath)
    const outputExports = parsedExportsInfo.get(normalizedExportPath)
    if (!outputExports) {
      continue
    }

    for (const [, composedExportType] of outputExports) {
      const exportMap: Record<string, string> = {}
      const matchedExportType =
        getSpecialExportTypeFromExportPath(composedExportType)

      // export type can be: default, development, react-server, etc.
      const sourceFile = sourceFilesMap[matchedExportType]
      if (!sourceFile) {
        continue
      }

      const matchedOutputExports =
        matchedExportType === 'default'
          ? outputExports.filter(([_outputPath, composed]) => {
              // For `default` case, exclude all the special export types,
              // since they should only work with specific export conditions.
              const types = composed.split('.')
              // If there's any special export type, filter it out
              return !types.some((type) => specialExportConventions.has(type))
            })
          : outputExports.filter(([_outputPath, composed]) => {
              return composed.split('.').includes(matchedExportType)
            })

      if (!entries[exportPath]) {
        entries[exportPath] = {
          source: sourceFile,
          name: normalizedExportPath,
          export: exportMap,
        }
      }

      matchedOutputExports.forEach(([outputPath, exportType]) => {
        exportMap[exportType] = outputPath
      })
    }
  }

  // Handling binaries
  for (const [exportPath, sourceFile] of bins) {
    const normalizedExportPath = normalizeExportPath(exportPath)
    const outputExports = parsedExportsInfo.get(normalizedExportPath)
    if (!outputExports) {
      continue
    }

    for (const [outputPath, exportType] of outputExports) {
      entries[exportPath] = {
        source: sourceFile,
        name: exportPath,
        export: {
          [exportType]: outputPath,
        },
      }
    }
  }

  return entries
}

export async function collectBinaries(
  entries: Entries,
  pkg: PackageMetadata,
  cwd: string,
) {
  const binaryExports = pkg.bin

  if (binaryExports) {
    // binDistPaths: [ [ 'bin1', './dist/bin1.js'], [ 'bin2', './dist/bin2.js'] ]
    const binPairs =
      typeof binaryExports === 'string'
        ? [['bin', binaryExports]]
        : Object.keys(binaryExports).map((key) => [
            join('bin', key),
            binaryExports[key],
          ])

    const binExportPaths = binPairs.reduce((acc, [binName, binDistPath]) => {
      const exportType = getExportTypeFromFile(binDistPath, pkg.type)

      acc[binName] = {
        [exportType]: binDistPath,
      }
      return acc
    }, {} as ExportPaths)

    for (const [binName] of binPairs) {
      const source = await getSourcePathFromExportPath(cwd, binName, BINARY_TAG)

      if (!source) {
        logger.warn(`Cannot find source file for ${binName}`)
        continue
      }

      const binEntryPath = await resolveSourceFile(cwd, source)
      entries[binName] = {
        source: binEntryPath,
        name: binName,
        export: binExportPaths[binName],
      }
    }
  }
}

export function getSpecialExportTypeFromExportPath(
  composedExportType: string,
): string {
  const exportTypes = composedExportType.split('.')
  for (const exportType of exportTypes) {
    if (specialExportConventions.has(exportType)) {
      return exportType
    }
  }
  return 'default'
}

// ./index -> import|require|default
// ./index.development -> development
// ./index.react-server -> react-server
function getExportTypeFromExportPath(exportPath: string): string {
  const exportTypes = new Set(exportPath.split('.'))
  let exportType = 'default'
  exportTypes.forEach((value) => {
    if (specialExportConventions.has(value)) {
      exportType = value
    } else if (value === 'import' || value === 'require') {
      exportType = value
    }
  })

  return exportType
}

// ./index -> .
// ./index.development -> .
// ./index.react-server -> .
// ./shared -> ./shared
// $binary -> $binary
// $binary/index -> $binary
// $binary/foo -> $binary/foo
export function normalizeExportPath(exportPath: string): string {
  if (exportPath === `${BINARY_TAG}/index`) {
    exportPath = BINARY_TAG
  }
  const baseName = baseNameWithoutExtension(exportPath)
  if (baseName === 'index') {
    return '.'
  }
  return exportPath
}

export async function collectSourceEntries(sourceFolderPath: string) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, Record<string, string>>()
  if (!fs.existsSync(sourceFolderPath)) {
    return {
      bins,
      exportsEntries,
    }
  }
  const entryFileDirentList = await fsp.readdir(sourceFolderPath, {
    withFileTypes: true,
  })
  for (const dirent of entryFileDirentList) {
    if (dirent.isDirectory()) {
      if (dirent.name === 'bin') {
        const binDirentList = await fsp.readdir(
          path.join(sourceFolderPath, dirent.name),
          {
            withFileTypes: true,
          },
        )
        for (const binDirent of binDirentList) {
          if (binDirent.isFile()) {
            const binFileAbsolutePath = path.join(
              sourceFolderPath,
              dirent.name,
              binDirent.name,
            )
            const binExportPath = sourceFilenameToExportPath(binDirent.name)
            if (fs.existsSync(binFileAbsolutePath)) {
              bins.set(
                posix.join(BINARY_TAG, binExportPath),
                binFileAbsolutePath,
              )
            }
          }
        }
      } else {
        // Search folder/<index>.<ext> convention entries
        for (const extension of availableExtensions) {
          const indexAbsoluteFile = path.join(
            dirent.path,
            dirent.name,
            `index.${extension}`,
          )
          if (
            fs.existsSync(indexAbsoluteFile) &&
            !isTestFile(indexAbsoluteFile)
          ) {
            const exportPath = sourceFilenameToExportPath(dirent.name)
            const sourceFilesMap = exportsEntries.get(exportPath) || {}
            const exportType = getExportTypeFromExportPath(exportPath)
            sourceFilesMap[exportType] = indexAbsoluteFile
            exportsEntries.set(exportPath, sourceFilesMap)
            break
          }
        }
      }
    } else if (dirent.isFile()) {
      const isAvailableExtension = availableExtensions.has(
        path.extname(dirent.name).slice(1),
      )
      if (isAvailableExtension) {
        const exportPath = sourceFilenameToExportPath(dirent.name)
        const isBinFile = exportPath === './bin'
        const fullPath = path.join(sourceFolderPath, dirent.name)
        if (isBinFile) {
          bins.set(BINARY_TAG, fullPath)
        } else {
          if (hasAvailableExtension(dirent.name) && !isTestFile(dirent.name)) {
            const sourceFilesMap = exportsEntries.get(exportPath) || {}
            const exportType = getExportTypeFromExportPath(exportPath)
            sourceFilesMap[exportType] = fullPath
            exportsEntries.set(exportPath, sourceFilesMap)
          }
        }
      }
    }
  }

  return {
    bins,
    exportsEntries,
  }
}
