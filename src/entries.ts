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

  // A mapping between each export path and its related special export conditions,
  // excluding the 'default' export condition.
  // { '.' => Set('development') }
  const pathSpecialConditionsMap: Record<string, Set<string>> = {}
  for (const [exportPath] of exportsEntries) {
    const normalizedExportPath = normalizeExportPath(exportPath)
    if (!pathSpecialConditionsMap[normalizedExportPath]) {
      pathSpecialConditionsMap[normalizedExportPath] = new Set()
    }

    const exportType = getExportTypeFromExportPath(exportPath)
    if (exportType !== 'default') {
      pathSpecialConditionsMap[normalizedExportPath].add(exportType)
    }
  }

  // Traverse source files and try to match the entries
  // Find exports from parsed exports info
  // entryExportPath can be: '.', './index.development', './shared.edge-light', etc.
  for (const [entryExportPath, sourceFilesMap] of exportsEntries) {
    const normalizedExportPath = normalizeExportPath(entryExportPath)
    const entryExportPathType = getExportTypeFromExportPath(entryExportPath)
    const outputExports = parsedExportsInfo.get(normalizedExportPath)

    if (!outputExports) {
      continue
    }

    for (const [outputPath, composedExportType] of outputExports) {
      const matchedExportType =
        getSpecialExportTypeFromExportPath(composedExportType)

      // export type can be: default, development, react-server, etc.
      const sourceFile =
        sourceFilesMap[matchedExportType] || sourceFilesMap.default
      if (!sourceFile) {
        continue
      }

      if (!entries[entryExportPath]) {
        entries[entryExportPath] = {
          source: sourceFile,
          name: normalizedExportPath,
          export: {},
        }
      }

      const exportMap = entries[entryExportPath].export
      if (
        entryExportPathType === 'default' &&
        matchedExportType !== 'default' &&
        pathSpecialConditionsMap[normalizedExportPath].size > 0
      ) {
        continue
      }

      exportMap[composedExportType] = outputPath
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

// ./index -> import|require|default
// ./index.development -> development
// ./index.react-server -> react-server
function getExportTypeFromExportPath(exportPath: string): string {
  // Skip the first two segments: `.` and `index`
  const exportTypes = exportPath.split('.').slice(2)
  return getExportTypeFromExportTypes(exportTypes)
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

function getExportTypeFromExportTypes(types: string[]): string {
  let exportType = 'default'
  new Set(types).forEach((value) => {
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
// ./shared.development -> ./shared
// $binary -> $binary
// $binary/index -> $binary
// $binary/foo -> $binary/foo
export function normalizeExportPath(exportPath: string): string {
  if (exportPath.startsWith(BINARY_TAG)) {
    if (exportPath === `${BINARY_TAG}/index`) {
      exportPath = BINARY_TAG
    }
    return exportPath
  }
  const baseName = exportPath.split('.').slice(0, 2).join('.')
  if (baseName === './index') {
    return '.'
  }
  return baseName
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
        // Search folder/index.<ext> convention entries
        for (const extension of availableExtensions) {
          const indexAbsoluteFile = path.join(
            dirent.path,
            dirent.name,
            `index.${extension}`,
          )
          // Search folder/index.<special type>.<ext> convention entries
          for (const specialExportType of runtimeExportConventions) {
            const indexSpecialAbsoluteFile = path.join(
              dirent.path,
              dirent.name,
              `index.${specialExportType}.${extension}`,
            )
            if (fs.existsSync(indexSpecialAbsoluteFile)) {
              // Add special export path
              // { ./<export path>.<special cond>: { <special cond>: 'index.<special cond>.<ext>' } }
              const exportPath = sourceFilenameToExportPath(dirent.name)
              const specialExportPath = exportPath + '.' + specialExportType
              const sourceFilesMap = exportsEntries.get(specialExportPath) || {}
              sourceFilesMap[specialExportType] = indexSpecialAbsoluteFile
              exportsEntries.set(specialExportPath, sourceFilesMap)
            }
          }
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
