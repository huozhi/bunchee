import { existsSync } from 'fs'
import fsp from 'fs/promises'
import path, { posix } from 'path'
import { glob } from 'glob'
import { getExportTypeFromFile, type ParsedExportsInfo } from './exports'
import { PackageMetadata, type Entries, ExportPaths } from './types'
import { logger } from './logger'
import { baseNameWithoutExtension, validateEntryFiles } from './util/file-path'
import {
  getSourcePathFromExportPath,
  isBinExportPath,
  isESModulePackage,
  isTestFile,
  isTypescriptFile,
  resolveSourceFile,
  sourceFilenameToExportFullPath,
} from './utils'
import {
  availableExtensions,
  BINARY_TAG,
  SRC,
  runtimeExportConventions,
  specialExportConventions,
  PRIVATE_GLOB_PATTERN,
  TESTS_GLOB_PATTERN,
} from './constants'
import { posixRelativify } from './lib/format'

export async function collectEntriesFromParsedExports(
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
  pkg: PackageMetadata,
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
    path.join(cwd, SRC),
    parsedExportsInfo,
    pkg,
  )

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
        // When we dealing with special export conditions, we need to make sure
        // the outputs won't override the default export output paths.
        // e.g. We have './index' -> { default: 'index.js', development: 'index.development.js' };
        // When we generate './index.react-server' -> { 'react-server': 'index.react-server.js' },
        // Normalize the entryExportPath to './index' first and check if it already exists with output paths.
        const normalizedEntryExportPath = stripSpecialCondition(entryExportPath)
        if (
          // The entry already exists, e.g. normalize './index.react-server' to './index'
          entries[normalizedEntryExportPath] &&
          // Is special export condition
          entryExportPathType !== 'default' &&
          // The extracted special condition is not the current loop one.
          entryExportPathType !== matchedExportType
        ) {
          continue
        }
        const exportMap = entries[entryExportPath].export
        exportMap[outputComposedExportType] = outputPath
      }
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
            path.join('bin', key),
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

export function getSpecialExportTypeFromSourcePath(sourcePath: string): string {
  const fileBaseName = baseNameWithoutExtension(sourcePath)
  return getSpecialExportTypeFromComposedExportPath(fileBaseName)
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

export function getSpecialExportTypeFromConditionNames(
  conditionNames: Set<string>,
): string {
  let exportType = 'default'
  conditionNames.forEach((value) => {
    if (specialExportConventions.has(value)) {
      exportType = value
    } else if (value === 'import' || value === 'require' || value === 'types') {
      // exportType = value
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
  const dirName = path.dirname(subpath) // Get directory name regardless of file/directory
  const baseName = path.basename(subpath) // Get base name regardless of file/directory
  const dirPath = path.join(sourceFolderPath, dirName)

  // Match <name>{,/index}.{<ext>,<runtime>.<ext>}
  const entryFilesPatterns = [
    `${baseName}.{${[...availableExtensions].join(',')}}`,
    `${baseName}.{${[...runtimeExportConventions].join(',')}}.{${[
      ...availableExtensions,
    ].join(',')}}`,
    `${baseName}/index.{${[...availableExtensions].join(',')}}`,
    `${baseName}/index.{${[...runtimeExportConventions].join(',')}}.{${[
      ...availableExtensions,
    ].join(',')}}`,
  ]

  const entryFiles = await glob(entryFilesPatterns, {
    cwd: dirPath,
    nodir: true,
    ignore: PRIVATE_GLOB_PATTERN,
  })

  validateEntryFiles(entryFiles)

  for (const file of entryFiles) {
    const ext = path.extname(file).slice(1)
    if (!availableExtensions.has(ext) || isTestFile(file)) continue

    const sourceFileAbsolutePath = path.join(dirPath, file)
    const exportPath = posixRelativify(
      existsSync(absoluteDirPath) &&
        (await fsp.stat(absoluteDirPath)).isDirectory()
        ? subpath
        : originalSubpath,
    )

    if (isBinaryPath) {
      bins.set(normalizeExportPath(originalSubpath), sourceFileAbsolutePath)
    } else {
      const parts = path.basename(file).split('.')
      const exportType =
        parts.length > 2 ? parts[1] : getExportTypeFromExportPath(exportPath)
      const specialExportPath =
        exportType !== 'index' && parts.length > 2
          ? exportPath + '.' + exportType
          : exportPath // Adjust for direct file matches

      const sourceFilesMap = exportsEntries.get(specialExportPath) || {}
      sourceFilesMap[exportType] = sourceFileAbsolutePath

      if (specialExportConventions.has(exportType)) {
        const fallbackExportPath =
          sourceFilenameToExportFullPath(originalSubpath)
        const fallbackSourceFilesMap =
          exportsEntries.get(fallbackExportPath) || {}
        Object.assign(sourceFilesMap, fallbackSourceFilesMap)
      }

      exportsEntries.set(specialExportPath, sourceFilesMap)
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
  pkg: PackageMetadata,
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
      await collectSourceEntriesByExportPath(
        sourceFolderPath,
        exportPath + '.' + specialCondition,
        bins,
        exportsEntries,
      )
    }
  }

  // Search private shared module files which are not in the parsedExportsInfo, but start with _.
  // Leading underscore: e.g. _utils.ts, _utils/index.ts
  // Segment contains leading underscore: e.g. a/_b/_c.ts, a/b/_c/index.ts
  // Contains special suffix: e.g. _utils.development.ts, _utils/index.development.js
  const suffixPattern = [...runtimeExportConventions].join(',')
  const extPattern = [...availableExtensions].join(',')
  const privatePattern = `**/_*{,/*}{,{.${suffixPattern}}}.{${extPattern}}`
  const privateFiles = await glob(privatePattern, {
    cwd: sourceFolderPath,
    nodir: true,
    ignore: TESTS_GLOB_PATTERN,
  })

  for (const file of privateFiles) {
    const sourceFileAbsolutePath = path.join(sourceFolderPath, file)
    const exportPath = sourceFilenameToExportFullPath(file)
    const isEsmPkg = isESModulePackage(pkg.type)

    // const specialItems: [string, string][] = []
    const specialExportType = getSpecialExportTypeFromSourcePath(file)
    const normalizedExportPath = stripSpecialCondition(exportPath)
    const isSpecialExport = specialExportType !== 'default'

    // export type: default => ''
    // export type: development => '.development'
    const condPart = isSpecialExport ? specialExportType + '.' : ''

    // Map private shared files to the dist directory
    // e.g. ./_utils.ts -> ./dist/_utils.js
    // TODO: improve the logic to only generate the required files, not all possible files
    const isTs = isTypescriptFile(file)
    const typesInfos: [string, string][] = [
      [
        posixRelativify(
          posix.join('./dist', exportPath + (isEsmPkg ? '.d.ts' : '.d.mts')),
        ),
        condPart + 'import.types',
      ],
      [
        posixRelativify(
          posix.join('./dist', exportPath + (isEsmPkg ? '.d.cts' : '.d.ts')),
        ),
        condPart + 'require.types',
      ],
    ]
    const privateExportInfo: [string, string][] = [
      [
        posixRelativify(
          posix.join('./dist', exportPath + (isEsmPkg ? '.js' : '.mjs')),
        ),
        condPart + 'import',
      ],
      [
        posixRelativify(
          posix.join('./dist', exportPath + (isEsmPkg ? '.cjs' : '.js')),
        ),
        condPart + 'require',
      ],
      ...(isTs ? typesInfos : []),
    ]

    const exportsInfo = parsedExportsInfo.get(normalizedExportPath)
    if (!exportsInfo) {
      // Add private shared files to parsedExportsInfo
      parsedExportsInfo.set(normalizedExportPath, privateExportInfo)
    } else {
      // Merge private shared files to the existing exportsInfo
      exportsInfo.push(...privateExportInfo)
    }

    // Insert private shared modules into the entries
    const entry = exportsEntries.get(exportPath)
    if (!entry) {
      exportsEntries.set(exportPath, {
        [specialExportType]: sourceFileAbsolutePath,
      })
    } else {
      entry[specialExportType] = sourceFileAbsolutePath
    }
  }

  return {
    bins,
    exportsEntries,
  }
}
