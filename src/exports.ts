import type { PackageMetadata, ExportCondition, FullExportCondition, PackageType, ParsedExportCondition } from './types'
import { join, resolve } from 'path'

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
    ([key, value]) => typeof value === 'string' && !key.startsWith('.')
  )
}

function constructFullExportCondition(
  value: string | Record<string, string | undefined>,
  packageType: PackageType
): FullExportCondition {
  const isCommonjs = packageType === 'commonjs'
  let result: FullExportCondition
  if (typeof value === 'string') {
    result = {
      [isCommonjs ? 'require' : 'import']: value,
    }
  } else {
    // TODO: valid export condition, warn if it's not valid
    const keys: string[] = Object.keys(value)
    result = {}
    keys.forEach((key) => {
      // Filter out nullable value
      if ((key in value) && value[key]) {
        result[key] = value[key] as string
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
  value: ExportCondition,
  paths: Record<string, FullExportCondition>,
  packageType: 'commonjs' | 'module'
): void {
  // TODO: handle export condition based on package.type
  if (isExportLike(value)) {
    paths[name] = constructFullExportCondition(value, packageType)
    return
  }

  Object.keys(value).forEach((subpath) => {
    const nextName = joinRelativePath(name, subpath)

    const nestedValue = value[subpath]
    findExport(nextName, nestedValue, paths, packageType)
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
function parseExport(exportsCondition: ExportCondition, packageType: PackageType) {
  const paths: Record<string, FullExportCondition> = {}

  if (typeof exportsCondition === 'string') {
    paths['.'] = constructFullExportCondition(exportsCondition, packageType)
  } else if (typeof exportsCondition === 'object') {
    Object.keys(exportsCondition).forEach((key: string) => {
      const value = exportsCondition[key]
      findExport(key, value, paths, packageType)
    })
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

export function getExportPaths(pkg: PackageMetadata) {
  const pathsMap: Record<string, FullExportCondition> = {}
  const packageType = getPackageType(pkg)

  const { exports: exportsConditions } = pkg
  if (exportsConditions) {
    const paths = parseExport(exportsConditions, packageType)
    Object.assign(pathsMap, paths)
  }

  // main export '.' from main/module/typings
  const defaultMainExport = constructFullExportCondition(
    {
      [packageType === 'commonjs' ? 'require' : 'import']: pkg.main,
      module: pkg.module,
      types: getTypings(pkg),
    },
    packageType
  )

  // Merge the main export into '.' paths
  const mainExport = Object.assign({}, pathsMap['.'], defaultMainExport)
  // main export is not empty
  if (Object.keys(mainExport).length > 0) {
    pathsMap['.'] = mainExport
  }

  return pathsMap
}

export function getPackageType(pkg: PackageMetadata): PackageType {
  return pkg.type || 'commonjs'
}

export function constructDefaultExportCondition(
  value: string | Record<string, string | undefined>,
  packageType: PackageType
) {
  const objValue =
    typeof value === 'string'
    ? {
      [packageType === 'commonjs' ? 'require' : 'import']: value,
      types: getTypings(value as PackageMetadata),
    } : value
  return constructFullExportCondition(
    objValue,
    packageType
  )
}

export function isEsmExportName(name: string) {
  return ['import', 'module', 'react-native', 'react-server', 'edge-light'].includes(name)
}

export function isCjsExportName(name: string) {
  return ['require', 'main', 'node', 'default'].includes(name)
}

export function getExportConditionDist(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string
) {
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  const existed = new Set<string>()
  const exportTypes = Object.keys(parsedExportCondition.export)

  for (const key of exportTypes) {
    if (key === 'types') {
      continue
    }
    const relativePath = parsedExportCondition.export[key]
    const distFile = getDistPath(relativePath, cwd)

    let format: 'cjs' | 'esm' = 'esm'
    if (isEsmExportName(key)) {
      format = 'esm'
    } else if (isCjsExportName(key)) {
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
    console.error(`Doesn't fin any exports in ${pkg.name}, using default dist path dist/index.js`)
    dist.push({ format: 'esm', file: getDistPath('dist/index.js', cwd) })
  }
  return dist
}
