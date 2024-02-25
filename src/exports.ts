import { posix, join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import {
  baseNameWithoutExtension,
  hasCjsExtension,
  joinRelativePath,
} from './utils'
import {
  BINARY_TAG,
  dtsExtensionsMap,
  optimizeConventions,
  suffixedExportConventions,
} from './constants'
import { OutputOptions } from 'rollup'

export function getPackageTypings(pkg: PackageMetadata) {
  return pkg.types || pkg.typings
}

// Reached the end of the export path
function isExportLike(field: any): field is string | FullExportCondition {
  if (typeof field === 'string') return true
  return Object.entries(field).every(
    // Every value is string and key is not start with '.'
    ([key, value]) => typeof value === 'string' && !key.startsWith('.'),
  )
}

function constructFullExportCondition(
  exportCondition: string | Record<string, string | undefined>,
  packageType: PackageType,
): FullExportCondition {
  let fullExportCond: FullExportCondition
  if (typeof exportCondition === 'string') {
    const exportType = getExportTypeFromFile(exportCondition, packageType)

    fullExportCond = {
      [exportType]: exportCondition,
    }
  } else {
    const exportTypes: string[] = Object.keys(exportCondition)
    fullExportCond = {}
    exportTypes.forEach((exportType) => {
      const condition = exportCondition[exportType]
      // Filter out nullable value
      if (condition) {
        fullExportCond[exportType] = condition
      }
    })
  }

  return fullExportCond
}

function concatExportName(first: string, second: string) {
  return (first.endsWith('.') ? first.slice(0, -1) : first) + '.' + second
}

const getFirstExportPath = (
  fullExportCondition: ExportCondition | FullExportCondition,
): string => {
  // Handle all export cond { <require|import|default>: ... }
  if (typeof fullExportCondition === 'object') {
    for (const key of Object.keys(fullExportCondition)) {
      if (key.startsWith('.') || key === 'types') {
        continue
      }
      return fullExportCondition[key] as string
    }
  }
  return fullExportCondition as string
}

const appendExportCondition = (exportPath: string, condition: string) => {
  return (exportPath === '.' ? '' : exportPath) + '.' + condition
}

const specialExportTypes = new Set([
  ...suffixedExportConventions,
  ...optimizeConventions,
])

function findExport(
  exportPath: string,
  exportCondition: ExportCondition,
  paths: Record<string, FullExportCondition>,
  packageType: 'commonjs' | 'module',
  currentPath: string,
): void {
  if (exportPath === 'types') return
  if (isExportLike(exportCondition)) {
    const fullExportCondition = constructFullExportCondition(
      exportCondition,
      packageType,
    )

    if (exportPath.startsWith('.')) {
      paths[exportPath] = {
        ...paths[exportPath],
        ...fullExportCondition,
      }
    } else {
      const exportJsBundlePath = getFirstExportPath(fullExportCondition)

      if (specialExportTypes.has(exportPath)) {
        const specialPath = appendExportCondition(currentPath, exportPath)
        paths[specialPath] = {
          ...paths[specialPath],
          ...(exportCondition as FullExportCondition),
        }
      } else {
        // exportPath is exportType, import, require, ...
        // merge to currentPath
        paths[currentPath] = {
          ...paths[currentPath],
          [exportPath]: exportJsBundlePath,
        }
      }
    }
    return
  }

  Object.keys(exportCondition).forEach((subpath) => {
    if (subpath.startsWith('.')) {
      // subpath is actual export path, ./a, ./b, ...
      const nestedExportPath = joinRelativePath(currentPath, subpath)

      const nestedExportCondition = exportCondition[subpath]
      findExport(
        nestedExportPath,
        nestedExportCondition,
        paths,
        packageType,
        nestedExportPath,
      )
    } else {
      // subpath is exportType, import, require, ...
      const exportType = subpath
      if (typeof exportCondition[subpath] === 'object') {
        const defaultPath = (exportCondition[subpath] as any).default
        if (defaultPath) {
          const nestedExportCondition = { [exportType]: defaultPath }
          findExport(
            exportPath,
            nestedExportCondition,
            paths,
            packageType,
            currentPath,
          )
        }
        // Find special export type, such as import: { development: './dev.js', production: './prod.js' }
        const conditionSpecialTypes = Object.keys(
          exportCondition[exportType],
        ).filter((key) => specialExportTypes.has(key))
        for (const conditionSpecialType of conditionSpecialTypes) {
          // e.g. import.development
          const composedKey = concatExportName(exportType, conditionSpecialType)

          const nestedExportConditionPath = {
            [composedKey]: (exportCondition[exportType] as any)[
              conditionSpecialType
            ],
          }

          const nestedExportPath = joinRelativePath(currentPath, exportPath)
          findExport(
            exportPath,
            nestedExportConditionPath,
            paths,
            packageType,
            nestedExportPath,
          )
        }
      }
      const defaultPath =
        typeof exportCondition[subpath] === 'object'
          ? (exportCondition[subpath] as any).default
          : exportCondition[subpath]
      const nestedExportCondition = { [exportType]: defaultPath }

      const nestedExportPath = joinRelativePath(currentPath, exportPath)
      findExport(
        exportPath,
        nestedExportCondition,
        paths,
        packageType,
        nestedExportPath,
      )
    }
  })
}

/**
 *
 * Convert package.exports field to paths mapping
 * Output a map
 *
 * Example 1.
 *
 * Input:
 * {
 *   "./sub": {
 *     "import": {
 *       "types": "./sub.js",
 *       "default": "./sub.cjs",
 *     }
 *   }
 * }
 *
 * Output:
 * {
 *   "./sub": {
 *     "import": "./sub.js",
 *     "require": "./sub.cjs",
 *     "types": "./sub.d.ts",
 *   }
 * }
 *
 * Example 2.
 *
 * Input
 * {
 *   ".": {
 *     "import,": {
 *       "development": "./dev.js",
 *       "production": "./prod.js"
 *     }
 *   },
 *   "./sub": {
 *     "import": "./sub.js"
 *   }
 * }
 *
 * Output
 * {
 *   ".": {
 *     "import.development": "./dev.js",
 *     "import.production": "./prod.js"
 *  },
 *  "./sub" {
 *    import": "./sub.js"
 * }
 *
 *
 */
function parseExport(
  exportsCondition: ExportCondition,
  packageType: PackageType,
) {
  const paths: Record<string, FullExportCondition> = {}
  const initialPath = '.'
  if (typeof exportsCondition === 'string') {
    paths[initialPath] = constructFullExportCondition(
      exportsCondition,
      packageType,
    )
  } else if (typeof exportsCondition === 'object') {
    if (isExportLike(exportsCondition)) {
      paths[initialPath] = constructFullExportCondition(
        exportsCondition,
        packageType,
      )
    } else {
      Object.keys(exportsCondition).forEach((key: string) => {
        const exportCondition = exportsCondition[key]
        findExport(key, exportCondition, paths, packageType, initialPath)
      })
    }
  }
  return paths
}

/**
 * Get package exports paths
 *
 * Example:
 *
 * ```json
 * {
 *  "exports": {
 *    ".": {
 *      "require": "./dist/index.cjs",
 *      "module": "./dist/index.esm.js",
 *      "default": "./dist/index.esm.js"
 *    },
 *    "./foo": {
 *      "require": "./dist/foo.cjs",
 *      "module": "./dist/foo.esm.js",
 *      "default": "./dist/foo.esm.js"
 *   }
 * }
 *
 * ```
 *
 * will be parsed to:
 *
 * ```js
 * {
 *   '.': {
 *     main: './dist/index.cjs',
 *     module: './dist/index.esm.js',
 *     export: './dist/index.esm.js'
 *   },
 *   './foo': {
 *     main: './dist/foo.cjs',
 *     module: './dist/foo.esm.js',
 *     export: './dist/foo.esm.js'
 *   }
 *
 *
 * pkg.main and pkg.module will be added to ['.'] if exists
 */

export function getExportPaths(
  pkg: PackageMetadata,
  resolvedWildcardExports?: ExportCondition,
) {
  let pathsMap: Record<string, FullExportCondition> = {}
  const packageType = getPackageType(pkg)
  const isEsmPackage = isESModulePackage(packageType)

  const exportsConditions = resolvedWildcardExports ?? pkg.exports

  if (exportsConditions) {
    const paths = parseExport(exportsConditions, packageType)
    pathsMap = {
      ...pathsMap,
      ...paths,
    }
  }
  // main export '.' from main/module/typings
  let mainExportCondition
  if (pkg.main) {
    const mainExportType = isEsmPackage
      ? hasCjsExtension(pkg.main!)
        ? 'require'
        : 'import'
      : 'require'
    mainExportCondition = { [mainExportType]: pkg.main }
  }
  const defaultMainExport = constructFullExportCondition(
    {
      ...mainExportCondition,
      module: pkg.module,
      types: getPackageTypings(pkg),
    },
    packageType,
  )

  if (!isEsmPackage && pathsMap['.']?.['require']) {
    // pathsMap's exports.require are prioritized.
    defaultMainExport['require'] = pathsMap['.']['require']
  }

  // Merge the main export into '.' paths
  const mainExport = {
    ...pathsMap['.'],
    ...defaultMainExport,
  }
  // main export is not empty
  if (Object.keys(mainExport).length > 0) {
    pathsMap['.'] = {
      ...pathsMap['.'],
      ...mainExport,
    }
  }

  return pathsMap
}

/**
 * export path: -> [ output path, export type ]
 */
export type ParsedExportsInfo = Map<string, [string, string][]>

function collectExportPath(
  exportValue: ExportCondition,
  currentPath: string,
  exportTypes: Set<string>,
  exportToDist: ParsedExportsInfo,
) {
  // End of searching, export value is file path.
  if (typeof exportValue === 'string') {
    // exportTypes.add('require')
    // childExports.add('default')
    const exportInfo = exportToDist.get(currentPath)
    if (!exportInfo) {
      const outputConditionPair: [string, string] = [
        exportValue,
        Array.from(exportTypes).join('.'),
      ]
      exportToDist.set(currentPath, [outputConditionPair])
    } else {
      exportInfo.push([exportValue, Array.from(exportTypes).join('.')])
    }
    return
  }

  const exportKeys = Object.keys(exportValue)
  for (const exportKey of exportKeys) {
    const childExports = new Set(exportTypes)
    // Normalize child export value to a map
    const childExportValue = exportValue[exportKey]
    // Visit export path: ./subpath, ./subpath2, ...
    if (exportKey.startsWith('.')) {
      const childPath = joinRelativePath(currentPath, exportKey)
      collectExportPath(childExportValue, childPath, childExports, exportToDist)
    } else {
      // Visit export type: import, require, ...
      childExports.add(exportKey)
      collectExportPath(
        childExportValue,
        currentPath,
        childExports,
        exportToDist,
      )
    }
  }
}

/**
 * parseExports - parse package.exports field
 *
 * map from export path to output path and export conditions
 */
export function parseExports(
  pkg: PackageMetadata,
  // exportsField: ExportCondition,
  // _moduleType: 'commonjs' | 'module' | undefined,
): ParsedExportsInfo {
  const exportsField = pkg.exports ?? {}
  const bins = pkg.bin ?? {}
  const exportToDist: ParsedExportsInfo = new Map()
  let currentPath = '.'

  if (typeof exportsField === 'string') {
    const outputConditionPair: [string, string] = [exportsField, 'default']
    exportToDist.set(currentPath, [outputConditionPair])
  } else {
    // keys means unknown if they're relative path or export type
    const exportConditionKeys = Object.keys(exportsField)

    for (const exportKey of exportConditionKeys) {
      const exportValue = exportsField[exportKey]
      const exportTypes: Set<string> = new Set()
      const isExportPath = exportKey.startsWith('.')
      const childPath = isExportPath
        ? joinRelativePath(currentPath, exportKey)
        : currentPath

      collectExportPath(exportValue, childPath, exportTypes, exportToDist)
    }
  }

  if (typeof bins === 'string') {
    const outputConditionPair: [string, string] = [bins, 'default']
    exportToDist.set(BINARY_TAG, [outputConditionPair])
  } else {
    for (const binName of Object.keys(bins)) {
      const binDistPath = bins[binName]
      const exportType = getExportTypeFromFile(binDistPath, pkg.type)
      const exportPath = posix.join(BINARY_TAG, binName)
      const outputConditionPair: [string, string] = [binDistPath, exportType]
      exportToDist.set(exportPath, [outputConditionPair])
    }
  }
  return exportToDist
}

function parseBinaries(pkg: PackageMetadata) {
  const binExports = pkg.bin

  if (binExports) {
    const binPairs =
      typeof binExports === 'string'
        ? [['bin', binExports]]
        : Object.keys(binExports).map((key) => [
            join('bin', key),
            binExports[key],
          ])

    const binExportPaths = binPairs.reduce((acc, [binName, binDistPath]) => {
      const exportType = getExportTypeFromFile(binDistPath, pkg.type)
      const exportPath = join('bin', binName)
      return {
        ...acc,
        [exportPath]: {
          [exportType]: binDistPath,
        },
      }
    }, {})

    return binExportPaths
  }
}

export function getPackageType(pkg: PackageMetadata): PackageType {
  return pkg.type || 'commonjs'
}

export function isESModulePackage(packageType: string | undefined) {
  return packageType === 'module'
}

export function constructDefaultExportCondition(
  value: string | Record<string, string | undefined>,
  packageType: PackageType,
) {
  const isEsmPackage = isESModulePackage(packageType)
  let exportCondition
  if (typeof value === 'string') {
    const types = getPackageTypings(value as PackageMetadata)
    exportCondition = {
      [isEsmPackage ? 'import' : 'require']: value,
      ...(types && { types }),
    }
  } else {
    exportCondition = value
  }
  return constructFullExportCondition(exportCondition, packageType)
}

export function isEsmExportName(name: string, ext: string) {
  return ['import', 'module'].includes(name) || ext === 'mjs'
}

export function isCjsExportName(
  pkg: PackageMetadata,
  exportCondition: string,
  ext: string,
) {
  const isESModule = isESModulePackage(pkg.type)
  const isCjsCondition = ['require', 'main'].includes(exportCondition)
  const isNotEsmExportName = !isEsmExportName(exportCondition, ext)
  return (
    (!isESModule && isNotEsmExportName && (ext !== 'mjs' || isCjsCondition)) ||
    ext === 'cjs'
  )
}

export function getExportsDistFilesOfCondition(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
): { format: OutputOptions['format']; file: string }[] {
  const dist: { format: OutputOptions['format']; file: string }[] = []
  const exportConditionNames = Object.keys(parsedExportCondition.export)
  const uniqueFiles = new Set<string>()
  for (const exportCondition of exportConditionNames) {
    if (exportCondition === 'types') {
      continue
    }
    const filePath = parsedExportCondition.export[exportCondition]
    const ext = extname(filePath).slice(1)
    const relativePath = parsedExportCondition.export[exportCondition]
    const distFile = resolve(cwd, relativePath)
    const format: OutputOptions['format'] = isCjsExportName(
      pkg,
      exportCondition,
      ext,
    )
      ? 'cjs'
      : 'esm'

    if (uniqueFiles.has(distFile)) {
      continue
    }
    uniqueFiles.add(distFile)
    dist.push({ format, file: distFile })
  }

  return dist
}

export function getExportFileTypePath(absoluteJsBundlePath: string) {
  const dirName = dirname(absoluteJsBundlePath)
  const baseName = baseNameWithoutExtension(absoluteJsBundlePath)
  const ext = extname(absoluteJsBundlePath).slice(
    1,
  ) as keyof typeof dtsExtensionsMap
  const typeExtension = dtsExtensionsMap[ext]
  return join(dirName, baseName + '.' + typeExtension)
}

export function getExportTypeFromFile(
  filename: string,
  pkgType: string | undefined,
) {
  const isESModule = isESModulePackage(pkgType)
  const isCjsExt = filename.endsWith('.cjs')
  const isEsmExt = filename.endsWith('.mjs')

  const exportType = isEsmExt
    ? 'import'
    : isCjsExt
    ? 'require'
    : isESModule
    ? 'import'
    : 'require'
  return exportType
}
