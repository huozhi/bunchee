import fs from 'fs'
import fsp from 'fs/promises'
import path, { basename, dirname, extname, join, posix } from 'path'
import { getExportTypeFromFile, type ParsedExportsInfo } from './exports'
import { PackageMetadata, type Entries, ExportPaths } from './types'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  getFileBasename,
  getSourcePathFromExportPath,
  isBinExportPath,
  isTestFile,
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
function sourceFilenameToExportFullPath(filename: string) {
  const baseName = baseNameWithoutExtension(filename)
  let exportPath = baseName

  return relativify(exportPath)
}

export async function collectEntriesFromParsedExports(
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
  sourceFile: string | undefined,
): Promise<Entries> {
  const entries: Entries = {}
  if (sourceFile) {
    const defaultExport = parsedExportsInfo.get('./index')![0]
    entries['./index'] = {
      source: sourceFile,
      name: '.',
      export: {
        default: defaultExport[0],
      },
    }
  }

  // Find source files
  const { bins, exportsEntries } = await collectSourceEntriesFromExportPaths(
    join(cwd, SRC),
    parsedExportsInfo,
  )

  // console.log(
  //   ':exportsEntries', exportsEntries,
  //   'parsedExportsInfo', parsedExportsInfo
  // )

  // A mapping between each export path and its related special export conditions,
  // excluding the 'default' export condition.
  // { './index' => Set('development', 'edge-light') }
  const pathSpecialConditionsMap: Record<string, Set<string>> = {}
  for (const [exportPath] of exportsEntries) {
    const normalizedExportPath = stripSpecialCondition(exportPath)
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
  // entryExportPath can be: './index', './index.development', './shared.edge-light', etc.
  for (const [entryExportPath, sourceFilesMap] of exportsEntries) {
    const normalizedExportPath = stripSpecialCondition(entryExportPath)

    const entryExportPathType = getExportTypeFromExportPath(entryExportPath)
    const outputExports = parsedExportsInfo.get(normalizedExportPath)
    if (!outputExports) {
      continue
    }

    for (const [outputPath, outputComposedExportType] of outputExports) {
      // export type can be: default, development, react-server, etc.

      const matchedExportType = getSpecialExportTypeFromComposedExportPath(
        outputComposedExportType,
      )
      const specialSet = pathSpecialConditionsMap[normalizedExportPath]
      const hasSpecialEntry = specialSet.has(matchedExportType)
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
      } else if (matchedExportType === entryExportPathType) {
        entries[entryExportPath].source = sourceFile
      }

      // output exports match
      if (
        matchedExportType === entryExportPathType ||
        (!hasSpecialEntry && matchedExportType !== 'default')
      ) {
        const exportMap = entries[entryExportPath].export
        exportMap[outputComposedExportType] = outputPath
      }
      // console.log('match', matchedExportType, 'vs', entryExportPathType, sourceFile)
    }
  }

  // Handling binaries
  for (const [exportPath, sourceFile] of bins) {
    const outputExports = parsedExportsInfo.get(exportPath)
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

// ./index -> default
// ./index.development -> development
// ./index.react-server -> react-server
function getExportTypeFromExportPath(exportPath: string): string {
  // Skip the first two segments: `.` and `index`
  const exportTypes = exportPath.split('.').slice(2)
  return getExportTypeFromExportTypesArray(exportTypes)
}

export function getSpecialExportTypeFromComposedExportPath(
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

function getExportTypeFromExportTypesArray(types: string[]): string {
  let exportType = 'default'
  new Set(types).forEach((value) => {
    if (specialExportConventions.has(value)) {
      exportType = value
    } else if (value === 'import' || value === 'require' || value === 'types') {
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

// ./index.react-server -> ./index
function stripSpecialCondition(exportPath: string): string {
  return exportPath.split('.').slice(0, 2).join('.')
}

export async function collectSourceEntriesByExportPath(
  sourceFolderPath: string,
  originalSubpath: string,
  bins: Map<string, string>,
  exportsEntries: Map<string, Record<string, string>>,
) {
  const isBinaryPath = isBinExportPath(originalSubpath)
  const subpath = originalSubpath.replace(BINARY_TAG, 'bin')
  const absoluteDirPath = path.join(sourceFolderPath, subpath)

  const isDirectory = fs.existsSync(absoluteDirPath)
    ? (await fsp.stat(absoluteDirPath)).isDirectory()
    : false

  // console.log('collectSourceEntriesByExportPath', originalSubpath, 'isDirectory', isDirectory)

  if (isDirectory) {
    if (isBinaryPath) {
      const binDirentList = await fsp.readdir(absoluteDirPath, {
        withFileTypes: true,
      })
      for (const binDirent of binDirentList) {
        if (binDirent.isFile()) {
          const binFileAbsolutePath = path.join(binDirent.path, binDirent.name)
          if (fs.existsSync(binFileAbsolutePath)) {
            bins.set(normalizeExportPath(originalSubpath), binFileAbsolutePath)
          }
        }
      }
    } else {
      // Search folder/index.<ext> convention entries
      for (const extension of availableExtensions) {
        const indexAbsoluteFile = path.join(
          absoluteDirPath,
          `index.${extension}`,
        )
        // Search folder/index.<special type>.<ext> convention entries
        for (const specialExportType of runtimeExportConventions) {
          const indexSpecialAbsoluteFile = path.join(
            absoluteDirPath,
            `index.${specialExportType}.${extension}`,
          )
          if (fs.existsSync(indexSpecialAbsoluteFile)) {
            // Add special export path
            // { ./<export path>.<special cond>: { <special cond>: 'index.<special cond>.<ext>' } }
            const exportPath = relativify(subpath)
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
          const exportPath = relativify(subpath)
          const sourceFilesMap = exportsEntries.get(exportPath) || {}
          const exportType = getExportTypeFromExportPath(exportPath)
          sourceFilesMap[exportType] = indexAbsoluteFile
          exportsEntries.set(exportPath, sourceFilesMap)
          break
        }
      }
    }
  } else {
    // subpath could be a file
    const dirName = dirname(subpath)
    const baseName = basename(subpath)
    // Read current file's directory
    const dirPath = path.join(sourceFolderPath, dirName)
    if (!fs.existsSync(dirPath)) {
      return
    }
    const dirents = await fsp.readdir(dirPath, {
      withFileTypes: true,
    })
    for (const dirent of dirents) {
      // index.development.js -> index.development
      const direntBaseName = baseNameWithoutExtension(dirent.name)
      const ext = extname(dirent.name).slice(1)
      if (
        !dirent.isFile() ||
        direntBaseName !== baseName ||
        !availableExtensions.has(ext)
      ) {
        continue
      }

      if (isTestFile(dirent.name)) {
        continue
      }

      const sourceFileAbsolutePath = path.join(dirent.path, dirent.name)

      // console.log('scan', sourceFileAbsolutePath, 'originalSubpath', originalSubpath, '>', exportFullPath)

      if (isBinaryPath) {
        bins.set(originalSubpath, sourceFileAbsolutePath)
      } else {
        let sourceFilesMap = exportsEntries.get(originalSubpath) || {}
        const exportType = getExportTypeFromExportPath(originalSubpath)
        sourceFilesMap[exportType] = sourceFileAbsolutePath

        if (specialExportConventions.has(exportType)) {
          // e.g. ./foo/index.react-server -> ./foo/index
          const fallbackExportPath =
            sourceFilenameToExportFullPath(originalSubpath)
          const fallbackSourceFilesMap =
            exportsEntries.get(fallbackExportPath) || {}
          sourceFilesMap = {
            ...fallbackSourceFilesMap,
            ...sourceFilesMap,
          }
        }

        // console.log('exportFullPath', originalSubpath, 'exportType', exportType, sourceFileAbsolutePath)

        exportsEntries.set(originalSubpath, sourceFilesMap)
      }
    }
  }
}

/**
 * exportsEntries {
 *   "./index" => {
 *      "development" => source"
 *      "react-server" => "source"
 *   },
 *  "./index.react-server" => {
 *      "development" => source"
 *      "react-server" => "source"
 *   }
 *  }
 */
export async function collectSourceEntriesFromExportPaths(
  sourceFolderPath: string,
  parsedExportsInfo: ParsedExportsInfo,
) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, Record<string, string>>()

  for (const [exportPath, exportInfo] of parsedExportsInfo.entries()) {
    const specialConditions = new Set<string>()
    for (const [_, composedExportType] of exportInfo) {
      const specialExportType =
        getSpecialExportTypeFromComposedExportPath(composedExportType)
      if (specialExportType !== 'default') {
        specialConditions.add(specialExportType)
      }
    }

    await collectSourceEntriesByExportPath(
      sourceFolderPath,
      exportPath,
      bins,
      exportsEntries,
    )

    for (const specialCondition of specialConditions) {
      // console.log(`exportPath + '.' + specialCondition`, exportPath + '.' + specialCondition)
      await collectSourceEntriesByExportPath(
        sourceFolderPath,
        exportPath + '.' + specialCondition,
        bins,
        exportsEntries,
      )
    }
  }

  return {
    bins,
    exportsEntries,
  }
}

// For `prepare`
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

  // Collect source files for `exports` field
  for (const dirent of entryFileDirentList) {
    if (getFileBasename(dirent.name) === 'bin') {
      continue
    }
    const exportPath = sourceFilenameToExportFullPath(dirent.name)

    await collectSourceEntriesByExportPath(
      sourceFolderPath,
      exportPath,
      bins,
      exportsEntries,
    )
  }

  // Collect source files for `bin` field
  const binDirent = entryFileDirentList.find(
    (dirent) => getFileBasename(dirent.name) === 'bin',
  )
  if (binDirent) {
    if (binDirent.isDirectory()) {
      const binDirentList = await fsp.readdir(
        path.join(binDirent.path, binDirent.name),
        {
          withFileTypes: true,
        },
      )
      for (const binDirent of binDirentList) {
        const binExportPath = posix.join(
          BINARY_TAG,
          getFileBasename(binDirent.name),
        )

        await collectSourceEntriesByExportPath(
          sourceFolderPath,
          binExportPath,
          bins,
          exportsEntries,
        )
      }
    } else {
      await collectSourceEntriesByExportPath(
        sourceFolderPath,
        BINARY_TAG,
        bins,
        exportsEntries,
      )
    }
  }

  return {
    bins,
    exportsEntries,
  }
}
