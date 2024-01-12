import { join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import { exit, filePathWithoutExtension, hasCjsExtension } from './utils'
import { dtsExtensionsMap } from './constants'

export function getTypings(pkg: PackageMetadata) {
  return pkg.types || pkg.typings
}

function getDistPath(distPath: string, cwd: string) {
  return resolve(cwd, distPath)
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
      // exportPath is exportType, import, require, ...
      // merge to currentPath
      paths[currentPath] = {
        ...paths[currentPath],
        [exportPath]: fullExportCondition.default,
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

export const getExportTypeDist = (
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
) => {
  const existed = new Set<string>()
  const exportTypes = Object.keys(parsedExportCondition.export)
  for (const key of exportTypes) {
    if (key === 'module') {
      continue
    }
    const filePath = parsedExportCondition.export[key]
    if (key === 'types') {
      const typeFile = getDistPath(filePath, cwd)
      if (existed.has(typeFile)) {
        continue
      }
      existed.add(typeFile)
      continue
    }
    const ext = extname(filePath).slice(1) as keyof typeof dtsExtensionsMap
    const typeFile = getDistPath(
      `${filePathWithoutExtension(filePath) || ''}.${dtsExtensionsMap[ext]}`,
      cwd,
    )
    if (existed.has(typeFile)) {
      continue
    }
    existed.add(typeFile)
  }
  return Array.from(existed)
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

function isCjsExportName(pkg: PackageMetadata, name: string, ext: string) {
  const isESModule = isESModulePackage(pkg.type)
  return (
    (!isESModule &&
      ['require', 'main', 'node'].includes(name) &&
      ext !== 'mjs') ||
    ext === 'cjs'
  )
}

export function getExportConditionDist(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
) {
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  const existed = new Set<string>()
  const exportTypes = Object.keys(parsedExportCondition.export)

  for (const exportType of exportTypes) {
    if (exportType === 'types') {
      continue
    }
    const filePath = parsedExportCondition.export[exportType]
    const ext = extname(filePath).slice(1)
    const relativePath = parsedExportCondition.export[exportType]
    const distFile = getDistPath(relativePath, cwd)

    let format: 'cjs' | 'esm' = 'esm'
    if (isCjsExportName(pkg, exportType, ext)) {
      format = 'cjs'
    }

    // Deduplicate the same path jobs
    // TODO: detect conflicts paths but with different format
    if (existed.has(distFile)) {
      continue
    }
    existed.add(distFile)
    dist.push({ format, file: distFile })
  }

  if (dist.length === 0 && !pkg.bin) {
    const defaultFormat = isESModulePackage(pkg.type) ? 'esm' : 'cjs'
    dist.push({
      format: defaultFormat,
      file: getDistPath('dist/index.js', cwd),
    })
  }
  return dist
}

export function getTypeFilePath(
  entryFilePath: string,
  exportCondition: ParsedExportCondition | undefined,
  cwd: string,
): string {
  const name = filePathWithoutExtension(entryFilePath)
  const firstDistPath = exportCondition
    ? Object.values(exportCondition.export)[0]
    : undefined

  const exportName = exportCondition?.name || 'index'

  return entryFilePath
    ? name + '.d.ts'
    : resolve(
        firstDistPath ? dirname(firstDistPath) : join(cwd, 'dist'),
        (exportName === '.' ? 'index' : exportName) + '.d.ts',
      )
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
