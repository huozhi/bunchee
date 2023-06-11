import type { PackageMetadata, ExportCondition, FullExportCondition, PackageType, ParsedExportCondition } from './types'
import { join, resolve } from 'path'

export function getTypings(pkg: PackageMetadata) {
  return pkg.types || pkg.typings
}

function getDistPath(distPath: string, cwd: string) {
  return resolve(cwd, distPath)
}

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
  packageType?: PackageType
): FullExportCondition {
  const isCommonjs = packageType === 'commonjs'
  let result: FullExportCondition
  if (typeof value === 'string') {
    // TODO: determine cjs or esm by "type" field in package.json
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
*        "require": "./sub.cjs",
 *     }
 *   }
 * }
 *
 * Output:
  * {
  *   "./sub": {
  *     "import": "./sub.js",
  *     "require": "./sub.cjs",
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
  const packageType: PackageType = pkg.type || 'commonjs'

  pathsMap['.'] = constructFullExportCondition(
    {
      [packageType === 'commonjs' ? 'require' : 'import']: pkg.main,
      'module': pkg.module,
    },
    packageType
  )

  const { exports: exportsConditions } = pkg
  if (exportsConditions) {
    const paths = parseExport(exportsConditions, packageType)
    Object.assign(pathsMap, paths)
  }

  return pathsMap
}

export function getExportConditionDist(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string
) {
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  const existed = new Set<string>()

  const exportTypes = Object.keys(parsedExportCondition.export)
  console.log('exportTypes', exportTypes)
  for (const key of exportTypes) {
    const relativePath = parsedExportCondition.export[key]
    const distFile = getDistPath(relativePath, cwd)

    let format: 'cjs' | 'esm' = 'esm'
    if ([ 'import', 'module', 'react-native', 'react-server', 'edge-light'].includes(key)) {
      format = 'esm'
    } else if (['require', 'main', 'node', 'default']) {
      format = 'cjs'
    }

    // Deduplicate the same path jobs
    // TODO: detect conflicts paths but with different format
    if (existed.has(distFile)) {
      continue
    }
    console.log('add:distFile', distFile)
    existed.add(distFile)
    dist.push({ format, file: distFile })
  }

  if (dist.length === 0) {
    // TODO: warn there's no exports detected
    console.error(`Doesn't fin any exports in ${pkg.name}`)
  }
  return dist
}
