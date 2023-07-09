import fs from 'fs'
import { join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import {
  availableExtensions,
  availableExportConventions,
  filenameWithoutExtension,
} from './utils'

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

function getEntries(path: string, hasSrc: boolean): string[] {
  const entryPath = hasSrc ? join(path, 'src') : path

  const entries = fs.readdirSync(entryPath, { withFileTypes: true })

  const availableExt = availableExtensions
    .concat(availableExportConventions)
    .map((ext) => `.${ext}`)

  return entries.flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name === 'src') {
        return getEntries(entryPath, (hasSrc = true))
      }
      return entry.name + '/index'
    }

    if (
      entry.isFile() &&
      availableExt.includes(extname(entry.name)) &&
      !entry.name.includes('index')
    ) {
      return filenameWithoutExtension(entry.name)!
    }
    return []
  })
}

function replaceWildcardsWithEntryName(
  obj: ExportCondition,
  dirName: string
): ExportCondition {
  if (typeof obj === 'string') {
    return obj.replace('*', dirName)
  } else if (typeof obj === 'object' && obj !== null) {
    const newObj: { [key: string]: ExportCondition | string } = {}

    for (let key in obj) {
      newObj[key] = replaceWildcardsWithEntryName(obj[key], dirName)
    }

    return newObj
  } else {
    return obj
  }
}

function resolveWildcardExports(
  exportsConditions: ExportCondition,
  cwd: string
): { [key: string]: ExportCondition | string } {
  const entryNames = getEntries(cwd, /*hasSrc=*/ false)

  const exportPaths = Object.keys(exportsConditions)

  const newExportsConditions: { [key: string]: ExportCondition | string } = {}

  for (let [exportPath, exportValue] of Object.entries(exportsConditions)) {
    if (exportPath.includes('*')) {
      entryNames.forEach((entryName) => {
        const newExportPath = exportPath
          .replace('*', entryName)
          .replace('/index', '')

        if (exportPaths.some((path) => path.startsWith(newExportPath))) {
          return
        }
        const newExportValue = replaceWildcardsWithEntryName(
          exportValue,
          entryName
        )
        newExportsConditions[newExportPath] = newExportValue
      })
    } else {
      newExportsConditions[exportPath] = exportValue
    }
  }

  return newExportsConditions
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
    if (isExportLike(exportsCondition)) {
      paths['.'] = constructFullExportCondition(exportsCondition, packageType)
    } else {
      Object.keys(exportsCondition).forEach((key: string) => {
        const value = exportsCondition[key]
        findExport(key, value, paths, packageType)
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

export function getExportPaths(pkg: PackageMetadata, cwd: string) {
  const pathsMap: Record<string, FullExportCondition> = {}
  const packageType = getPackageType(pkg)

  const { exports: exportsConditions } = pkg
  if (exportsConditions) {
    let validatedExportsConditions = exportsConditions

    const hasWildCardExport = Object.keys(exportsConditions).some((key) =>
      key.includes('*')
    )

    if (hasWildCardExport) {
      validatedExportsConditions = resolveWildcardExports(
        exportsConditions,
        cwd
      )
      console.log(validatedExportsConditions, 'validatedExportsConditions')
    }
    const paths = parseExport(validatedExportsConditions, packageType)
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

export function isEsmExportName(name: string, ext: string) {
  return ['import', 'module'].includes(name) || ext === 'mjs'
}

export function isCjsExportName(name: string, ext: string) {
  return ['require', 'main', 'node', 'default'].includes(name) || ext === 'cjs'
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
    console.error(`Doesn't fin any exports in ${pkg.name}, using default dist path dist/index.js`)
    dist.push({ format: 'esm', file: getDistPath('dist/index.js', cwd) })
  }
  return dist
}

export function getTypeFilePath(
  entryFilePath: string,
  exportCondition: ParsedExportCondition | undefined,
  cwd: string
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
        (exportName === '.' ? 'index' : exportName) +
          '.d.ts'
      )
}