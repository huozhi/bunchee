import { join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import { exit, filenameWithoutExtension, hasCjsExtension } from './utils'

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
    // TODO: check key is ExportType
    ([key, value]) => typeof value === 'string' && !key.startsWith('.'),
  )
}

function constructFullExportCondition(
  exportCondition: string | Record<string, string | undefined>,
  packageType: PackageType,
): FullExportCondition {
  const isCommonjs = packageType === 'commonjs'
  let result: FullExportCondition
  if (typeof exportCondition === 'string') {
    result = {
      [isCommonjs ? 'require' : 'import']: exportCondition,
    }
  } else {
    // TODO: valid export condition, warn if it's not valid
    const keys: string[] = Object.keys(exportCondition)
    result = {}
    keys.forEach((key) => {
      const condition = exportCondition[key]
      // Filter out nullable value
      if (key in exportCondition && condition) {
        result[key] = condition
      }
    })
  }

  return result
}

function joinRelativePath(...segments: string[]) {
  let result = join(...segments)
  // If the first segment starts with './', ensure the result does too.
  if (segments[0] === '.' && !result.startsWith('./')) {
    result = './' + result
  }
  return result
}

function findExport(
  name: string,
  exportCondition: ExportCondition,
  paths: Record<string, FullExportCondition>,
  packageType: 'commonjs' | 'module',
): void {
  // TODO: handle export condition based on package.type
  if (isExportLike(exportCondition)) {
    paths[name] = constructFullExportCondition(exportCondition, packageType)
    return
  }

  Object.keys(exportCondition).forEach((subpath) => {
    const nextName = joinRelativePath(name, subpath)

    const nestedExportCondition = exportCondition[subpath]
    findExport(nextName, nestedExportCondition, paths, packageType)
  })
}

/**
 *
 * Convert package.exports field to paths mapping
 * Example
 *
 * Input:
 * {
 *   ".": {
 *     "sub": {
 *       "import": "./sub.js",
 *       "require": "./sub.cjs",
 *       "types": "./sub.d.ts
 *     }
 *   }
 * }
 *
 * Output:
 * {
 *   "./sub": {
 *     "import": "./sub.js",
 *     "require": "./sub.cjs",
 *     "types": "./sub.d.ts,
 *   }
 * }
 *
 */
function parseExport(
  exportsCondition: ExportCondition,
  packageType: PackageType,
) {
  const paths: Record<string, FullExportCondition> = {}

  if (typeof exportsCondition === 'string') {
    paths['.'] = constructFullExportCondition(exportsCondition, packageType)
  } else if (typeof exportsCondition === 'object') {
    if (isExportLike(exportsCondition)) {
      paths['.'] = constructFullExportCondition(exportsCondition, packageType)
    } else {
      Object.keys(exportsCondition).forEach((key: string) => {
        const exportCondition = exportsCondition[key]
        findExport(key, exportCondition, paths, packageType)
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
  const pathsMap: Record<string, FullExportCondition> = {}
  const packageType = pkgType ?? getPackageType(pkg)
  const isCjsPackage = packageType === 'commonjs'

  const exportsConditions = resolvedWildcardExports ?? pkg.exports

  if (exportsConditions) {
    const paths = parseExport(exportsConditions, packageType)
    Object.assign(pathsMap, paths)
  }

  if (!isCjsPackage && pkg.main && hasCjsExtension(pkg.main)) {
    exit('Cannot export main field with .cjs extension in ESM package, only .mjs and .js extensions are allowed')
  }

  // main export '.' from main/module/typings
  const defaultMainExport = constructFullExportCondition(
    {
      [isCjsPackage ? 'require' : 'import']: pkg.main,
      module: pkg.module,
      types: getTypings(pkg),
    },
    packageType,
  )

  if (isCjsPackage && pathsMap['.']?.['require']) {
    // pathsMap's exports.require are prioritized.
    defaultMainExport['require'] = pathsMap['.']['require']
  }

  // Merge the main export into '.' paths
  const mainExport = Object.assign({}, pathsMap['.'], defaultMainExport)
  // main export is not empty
  if (Object.keys(mainExport).length > 0) {
    pathsMap['.'] = mainExport
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
    const ext = extname(filePath).slice(1)
    const dtsExtentions: Record<string, string> = {
      js: '.d.ts',
      cjs: '.d.cts',
      mjs: '.d.mts',
    }
    const typeFile = getDistPath(
      `${filenameWithoutExtension(filePath) || ''}${dtsExtentions[ext]}`,
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

export function constructDefaultExportCondition(
  value: string | Record<string, string | undefined>,
  packageType: PackageType,
) {
  let exportCondition
  if (typeof value === 'string') {
    const types = getTypings(value as PackageMetadata)
    exportCondition = {
      [packageType === 'commonjs' ? 'require' : 'import']: value,
      ...(types && {types}),
    }
  } else {
    exportCondition = value
  }
  return constructFullExportCondition(exportCondition, packageType)
}

export function isEsmExportName(name: string, ext: string) {
  return ['import', 'module'].includes(name) || ext === 'mjs'
}

export function isCjsExportName(name: string, ext: string) {
  return ['require', 'main', 'node', 'default'].includes(name) || ext === 'cjs'
}

export function getExportConditionDist(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
) {
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  const existed = new Set<string>()
  const exportTypes = Object.keys(parsedExportCondition.export)

  for (const key of exportTypes) {
    if (key === 'types') {
      continue
    }
    const filePath = parsedExportCondition.export[key]
    const ext = extname(filePath).slice(1)
    const relativePath = parsedExportCondition.export[key]
    const distFile = getDistPath(relativePath, cwd)

    let format: 'cjs' | 'esm' = 'esm'
    if (isEsmExportName(key, ext)) {
      format = 'esm'
    } else if (isCjsExportName(key, ext)) {
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

  if (dist.length === 0) {
    // TODO: Deprecate this warning and behavior in v3
    console.error(
      `Doesn't fin any exports in ${pkg.name}, using default dist path dist/index.js`,
    )
    dist.push({ format: 'esm', file: getDistPath('dist/index.js', cwd) })
  }
  return dist
}

export function getTypeFilePath(
  entryFilePath: string,
  exportCondition: ParsedExportCondition | undefined,
  cwd: string,
): string {
  const name = filenameWithoutExtension(entryFilePath)
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
