import { posix, join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  ParsedExportCondition,
} from './types'
import {
  getMainFieldExportType,
  isESModulePackage,
  joinRelativePath,
  normalizePath,
} from './utils'
import {
  hasWildcardPattern,
  expandWildcardPattern,
  substituteWildcardInPath,
} from './wildcard'
import { baseNameWithoutExtension } from './util/file-path'
import {
  BINARY_TAG,
  dtsExtensionsMap,
  specialExportConventions,
} from './constants'
import { OutputOptions } from 'rollup'

/**
 * A single output file declared by package.json, together with the export
 * conditions that lead to it, outermost first.
 *
 * `{ path: './dist/index.mjs', conditions: ['development', 'import', 'default'] }`
 *
 * Conditions are kept as a list rather than a dot-joined string so that
 * classification is a lookup instead of re-parsing. `conditionKey` produces the
 * dot-joined form where a stable map key or a log label is needed.
 */
export type OutputTarget = {
  path: string
  conditions: string[]
}

/**
 * export path -> the output targets declared for it
 */
export type ParsedExportsInfo = Map<string, OutputTarget[]>

export const conditionKey = (target: OutputTarget) =>
  target.conditions.join('.')

/**
 * Walk one export value, recording an output target for every leaf string.
 *
 * There is deliberately one walker: wildcard keys are expanded into concrete
 * keys before this runs, so it never needs to know about `*`.
 */
function collectExportPath(
  exportValue: ExportCondition,
  exportKey: string,
  currentPath: string,
  conditions: string[],
  exportToDist: ParsedExportsInfo,
) {
  // `null` blocks a subpath from being resolved, there's nothing to build for it.
  if (exportValue == null) {
    return
  }

  // End of searching, export value is file path.
  // <export key>: <export value> (string)
  if (typeof exportValue === 'string') {
    const condition = exportKey.startsWith('.') ? 'default' : exportKey
    // Dedupe while preserving the authored order, matching the old Set-based
    // composition (`{ import: { import: ... } }` composes to just `import`).
    const composed = conditions.includes(condition)
      ? conditions
      : [...conditions, condition]

    addToExportDistMap(exportToDist, currentPath, [
      { path: exportValue, conditions: composed },
    ])
    return
  }

  for (const childKey of Object.keys(exportValue)) {
    const childValue = exportValue[childKey]
    if (childKey.startsWith('.')) {
      // Visit export path: ./subpath, ./subpath2, ...
      collectExportPath(
        childValue,
        childKey,
        joinRelativePath(currentPath, childKey),
        conditions,
        exportToDist,
      )
    } else {
      // Visit export type: import, require, ...
      collectExportPath(
        childValue,
        childKey,
        currentPath,
        conditions.includes(childKey) ? conditions : [...conditions, childKey],
        exportToDist,
      )
    }
  }
}

const mapExportFullPath = (exportPath: string) =>
  exportPath === '.' ? './index' : exportPath

function addToExportDistMap(
  exportToDist: ParsedExportsInfo,
  exportPath: string,
  targets: OutputTarget[],
) {
  const fullPath = mapExportFullPath(exportPath)

  const existing = exportToDist.get(fullPath)
  if (!existing) {
    exportToDist.set(fullPath, targets)
  } else {
    existing.push(...targets)
  }
}

/** Replace every `*` in a nested export value with the matched subpath. */
function substituteWildcardDeep(
  exportValue: ExportCondition,
  matchedSubpath: string,
): ExportCondition {
  if (exportValue == null) {
    return null
  }
  if (typeof exportValue === 'string') {
    return substituteWildcardInPath(exportValue, matchedSubpath)
  }
  const result: Record<string, ExportCondition> = {}
  for (const [key, value] of Object.entries(exportValue)) {
    result[key] = substituteWildcardDeep(value, matchedSubpath)
  }
  return result
}

/**
 * Rewrite wildcard keys into concrete ones before any walking happens.
 *
 * Returns pairs rather than an object so that a literal subpath and a wildcard
 * that expands to the same subpath both survive, as they do today.
 */
async function expandExportKeys(
  exportsField: Record<string, ExportCondition>,
  cwd: string | undefined,
): Promise<[string, ExportCondition][]> {
  const pairs: [string, ExportCondition][] = []

  for (const exportKey of Object.keys(exportsField)) {
    const exportValue = exportsField[exportKey]
    const isExportPath = exportKey.startsWith('.')

    if (isExportPath && hasWildcardPattern(exportKey) && cwd) {
      const expanded = await expandWildcardPattern(exportKey, cwd)
      for (const [concreteExportPath, matchedSubpath] of expanded) {
        pairs.push([
          concreteExportPath,
          substituteWildcardDeep(exportValue, matchedSubpath),
        ])
      }
      continue
    }

    pairs.push([exportKey, exportValue])
  }

  return pairs
}

/**
 * parseExports - parse package.exports field and other fields like main,module to a map
 *
 * map from export path to output path and export conditions
 *
 * exportToDist: {
 *  './index': { development: ..., default: ... }
 *  './index.react-server': { development: ..., default: ... }
 * }
 */
export async function parseExports(
  pkg: PackageMetadata,
  cwd?: string,
): Promise<ParsedExportsInfo> {
  const exportsField = pkg.exports ?? {}
  const bins = pkg.bin ?? {}
  const exportToDist: ParsedExportsInfo = new Map()
  const isEsmPkg = isESModulePackage(pkg.type)
  const defaultCondition = isEsmPkg ? 'import' : 'require'

  const rootPath = '.'

  if (typeof exportsField === 'string') {
    addToExportDistMap(exportToDist, rootPath, [
      { path: exportsField, conditions: [defaultCondition] },
    ])
  } else {
    // Wildcards are resolved up front, so the walk below only sees concrete keys.
    const exportPairs = await expandExportKeys(exportsField, cwd)

    for (const [exportKey, exportValue] of exportPairs) {
      const isExportPath = exportKey.startsWith('.')
      collectExportPath(
        exportValue,
        exportKey,
        isExportPath ? joinRelativePath(rootPath, exportKey) : rootPath,
        isExportPath ? [] : [exportKey],
        exportToDist,
      )
    }
  }

  if (typeof bins === 'string') {
    addToExportDistMap(exportToDist, BINARY_TAG, [
      { path: bins, conditions: [defaultCondition] },
    ])
  } else {
    for (const binName of Object.keys(bins)) {
      const binDistPath = bins[binName]
      addToExportDistMap(exportToDist, posix.join(BINARY_TAG, binName), [
        {
          path: binDistPath,
          conditions: [getExportTypeFromFile(binDistPath, pkg.type)],
        },
      ])
    }
  }

  // Handle package.json main, module, and types fields
  if (pkg.main || pkg.module || pkg.types) {
    const rootFields: [string | undefined, string][] = [
      [pkg.main, getMainFieldExportType(pkg)],
      [pkg.module, 'module'],
      [pkg.types, 'types'],
    ]
    addToExportDistMap(
      exportToDist,
      './index',
      rootFields
        .filter(([path]) => Boolean(path))
        .map(([path, condition]) => ({
          path: path as string,
          conditions: [condition],
        })),
    )
  }

  return exportToDist
}

const esmConditions = new Set(['import', 'module', 'module-sync'])
const cjsConditions = new Set(['require', 'main'])

/**
 * Whether a target produces a declaration file rather than a JS asset.
 *
 * `types` is decisive wherever it appears: both `{ import: { types } }` and
 * `{ types: { import } }` are valid nestings in the wild.
 */
export const isTypesTarget = (target: OutputTarget) =>
  target.conditions.includes('types')

/**
 * The runtime/optimize condition a target belongs to, e.g. `react-server`,
 * `development`. `default` when it is not condition-specific.
 */
export const getSpecialCondition = (target: OutputTarget) =>
  target.conditions.find((cond) => specialExportConventions.has(cond)) ??
  'default'

/**
 * The single place that decides CJS vs ESM for an output file.
 *
 * The file extension plus `pkg.type` fully determines the format for any valid
 * package.json; the conditions only break ties for misconfigured ones (which
 * `lint` warns about separately).
 */
export function getOutputFormat(
  pkg: PackageMetadata,
  target: OutputTarget,
): 'cjs' | 'esm' {
  const ext = extname(target.path).slice(1)
  if (ext === 'cjs') return 'cjs'
  if (ext === 'mjs') {
    // `.mjs` is ESM unless a CJS package explicitly routes it through `require`.
    return !isESModulePackage(pkg.type) &&
      target.conditions.some((cond) => cjsConditions.has(cond))
      ? 'cjs'
      : 'esm'
  }
  if (isESModulePackage(pkg.type)) return 'esm'
  return target.conditions.some((cond) => esmConditions.has(cond))
    ? 'esm'
    : 'cjs'
}

export type ExportOutput = {
  format: OutputOptions['format']
  /** Absolute output path */
  file: string
  target: OutputTarget
}
export function getExportsDistFilesOfCondition(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
  dts: boolean,
): ExportOutput[] {
  const dist: ExportOutput[] = []
  const uniqueFiles = new Set<string>()
  for (const target of parsedExportCondition.targets) {
    // Types jobs emit declarations, asset jobs emit JS. Never both.
    if (dts !== isTypesTarget(target)) {
      continue
    }
    const distFile = resolve(cwd, target.path)
    if (uniqueFiles.has(distFile)) {
      continue
    }
    uniqueFiles.add(distFile)
    dist.push({
      format: getOutputFormat(pkg, target),
      file: distFile,
      target,
    })
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
  return normalizePath(join(dirName, baseName + '.' + typeExtension))
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
