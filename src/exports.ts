import { join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import { baseNameWithoutExtension, exit, hasCjsExtension } from './utils'
import { dtsExtensionsMap } from './constants'
import { OutputOptions } from 'rollup'

export function getTypings(pkg: PackageMetadata) {
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

function joinRelativePath(...segments: string[]) {
  let result = join(...segments)
  // If the first segment starts with '.', ensure the result does too.
  if (segments[0] === '.' && !result.startsWith('.')) {
    result = './' + result
  }
  return result
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

function findExport(
  exportPath: string,
  exportCondition: ExportCondition,
  paths: Record<string, FullExportCondition>,
  packageType: 'commonjs' | 'module',
  currentPath: string,
): void {
  // Skip `types` field, it cannot be the entry point
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

      // exportPath is exportType, import, require, ...
      // merge to currentPath
      paths[currentPath] = {
        ...paths[currentPath],
        [exportPath]: exportJsBundlePath,
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
      const defaultPath =
        typeof exportCondition[subpath] === 'object'
          ? (exportCondition[subpath] as any).default
          : exportCondition[subpath]
      const nestedExportCondition = { [exportType]: defaultPath }
      findExport(
        exportPath,
        nestedExportCondition,
        paths,
        packageType,
        currentPath,
      )
    }
  })
}

/**
 *
 * Convert package.exports field to paths mapping
 * Example
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
  pkgType?: PackageType,
  resolvedWildcardExports?: ExportCondition,
) {
  let pathsMap: Record<string, FullExportCondition> = {}
  const packageType = pkgType ?? getPackageType(pkg)
  const isEsmPackage = isESModulePackage(packageType)

  const exportsConditions = resolvedWildcardExports ?? pkg.exports

  if (exportsConditions) {
    const paths = parseExport(exportsConditions, packageType)
    pathsMap = {
      ...pathsMap,
      ...paths,
    }
  }

  if (isEsmPackage && pkg.main && hasCjsExtension(pkg.main)) {
    exit(
      'Cannot export main field with .cjs extension in ESM package, only .mjs and .js extensions are allowed',
    )
  }

  // main export '.' from main/module/typings
  const defaultMainExport = constructFullExportCondition(
    {
      [isEsmPackage ? 'import' : 'require']: pkg.main,
      module: pkg.module,
      types: getTypings(pkg),
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
    const types = getTypings(value as PackageMetadata)
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
  return (
    (!isESModule &&
      ['require', 'main'].includes(exportCondition) &&
      ext !== 'mjs') ||
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
