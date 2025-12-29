import { posix, join, resolve, dirname, extname } from 'path'
import type {
  PackageMetadata,
  ExportCondition,
  FullExportCondition,
  PackageType,
  ParsedExportCondition,
} from './types'
import {
  getMainFieldExportType,
  isESModulePackage,
  joinRelativePath,
  normalizePath,
  hasWildcardPattern,
  expandWildcardPattern,
  substituteWildcardInPath,
} from './utils'
import { baseNameWithoutExtension } from './util/file-path'
import { BINARY_TAG, dtsExtensionsMap } from './constants'
import { OutputOptions } from 'rollup'

export function getPackageTypings(pkg: PackageMetadata) {
  return pkg.types || pkg.typings
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

/**
 * export path: -> [ output path, export type ]
 */
export type ParsedExportsInfo = Map<string, [string, string][]>

/**
 * Process export value for wildcard patterns, substituting wildcards in output paths
 */
async function processWildcardExportValue(
  exportValue: ExportCondition,
  originalExportKey: string,
  currentPath: string,
  exportTypes: Set<string>,
  exportToDist: ParsedExportsInfo,
  matchedSubpath: string,
) {
  // End of searching, export value is file path.
  // <export key>: <export value> (string)
  if (typeof exportValue === 'string') {
    const composedTypes = new Set(exportTypes)
    const exportType = originalExportKey.startsWith('.')
      ? 'default'
      : originalExportKey
    composedTypes.add(exportType)
    const exportInfo = exportToDist.get(mapExportFullPath(currentPath))
    const exportCondition = Array.from(composedTypes).join('.')

    // Substitute wildcard in output path
    const substitutedPath = substituteWildcardInPath(
      exportValue,
      matchedSubpath,
    )

    if (!exportInfo) {
      const outputConditionPair: [string, string] = [
        substitutedPath,
        exportCondition,
      ]
      addToExportDistMap(exportToDist, currentPath, [outputConditionPair])
    } else {
      exportInfo.push([substitutedPath, exportCondition])
    }
    return
  }

  const exportKeys = Object.keys(exportValue)
  for (const exportKey of exportKeys) {
    // Clone the set to avoid modifying the parent set
    const childExports = new Set(exportTypes)
    // Normalize child export value to a map
    const childExportValue = exportValue[exportKey]

    // Substitute wildcard in nested string values
    let processedChildValue: ExportCondition = childExportValue
    if (typeof childExportValue === 'string') {
      processedChildValue = substituteWildcardInPath(
        childExportValue,
        matchedSubpath,
      )
    } else if (
      typeof childExportValue === 'object' &&
      childExportValue !== null
    ) {
      // Recursively process nested objects
      const processed: Record<string, ExportCondition | string> = {}
      for (const [key, value] of Object.entries(childExportValue)) {
        if (typeof value === 'string') {
          processed[key] = substituteWildcardInPath(value, matchedSubpath)
        } else if (value !== null && value !== undefined) {
          processed[key] = value
        }
      }
      processedChildValue = processed as ExportCondition
    }

    // Visit export path: ./subpath, ./subpath2, ...
    if (exportKey.startsWith('.')) {
      const childPath = joinRelativePath(currentPath, exportKey)
      await processWildcardExportValue(
        processedChildValue,
        exportKey,
        childPath,
        childExports,
        exportToDist,
        matchedSubpath,
      )
    } else {
      // Visit export type: import, require, ...
      childExports.add(exportKey)
      await processWildcardExportValue(
        processedChildValue,
        exportKey,
        currentPath,
        childExports,
        exportToDist,
        matchedSubpath,
      )
    }
  }
}

function collectExportPath(
  exportValue: ExportCondition,
  exportKey: string,
  currentPath: string,
  exportTypes: Set<string>,
  exportToDist: ParsedExportsInfo,
) {
  // End of searching, export value is file path.
  // <export key>: <export value> (string)
  if (typeof exportValue === 'string') {
    const composedTypes = new Set(exportTypes)
    const exportType = exportKey.startsWith('.') ? 'default' : exportKey
    composedTypes.add(exportType)
    const exportInfo = exportToDist.get(mapExportFullPath(currentPath))
    const exportCondition = Array.from(composedTypes).join('.')
    if (!exportInfo) {
      const outputConditionPair: [string, string] = [
        exportValue,
        exportCondition,
      ]
      addToExportDistMap(exportToDist, currentPath, [outputConditionPair])
    } else {
      exportInfo.push([exportValue, exportCondition])
    }
    return
  }

  const exportKeys = Object.keys(exportValue)
  for (const exportKey of exportKeys) {
    // Clone the set to avoid modifying the parent set
    const childExports = new Set(exportTypes)
    // Normalize child export value to a map
    const childExportValue = exportValue[exportKey]
    // Visit export path: ./subpath, ./subpath2, ...
    if (exportKey.startsWith('.')) {
      const childPath = joinRelativePath(currentPath, exportKey)
      collectExportPath(
        childExportValue,
        exportKey,
        childPath,
        childExports,
        exportToDist,
      )
    } else {
      // Visit export type: import, require, ...
      childExports.add(exportKey)
      collectExportPath(
        childExportValue,
        exportKey,
        currentPath,
        childExports,
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
  outputConditionPairs: [string, string][],
) {
  const fullPath = mapExportFullPath(exportPath)

  const existingExportInfo = exportToDist.get(fullPath)
  if (!existingExportInfo) {
    exportToDist.set(fullPath, outputConditionPairs)
  } else {
    existingExportInfo.push(...outputConditionPairs)
  }
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

  let currentPath = '.'

  if (typeof exportsField === 'string') {
    const outputConditionPair: [string, string] = [
      exportsField,
      defaultCondition,
    ]
    addToExportDistMap(exportToDist, currentPath, [outputConditionPair])
  } else {
    // keys means unknown if they're relative path or export type
    const exportConditionKeys = Object.keys(exportsField)

    for (const exportKey of exportConditionKeys) {
      const exportValue = exportsField[exportKey]
      const exportTypes: Set<string> = new Set()
      const isExportPath = exportKey.startsWith('.')

      // Handle wildcard patterns
      if (isExportPath && hasWildcardPattern(exportKey) && cwd) {
        // Expand wildcard pattern to concrete exports
        const expanded = await expandWildcardPattern(exportKey, cwd)

        for (const [concreteExportPath, matchedSubpath] of expanded) {
          const childPath = joinRelativePath(currentPath, concreteExportPath)

          // Process the export value and substitute wildcards in output paths
          await processWildcardExportValue(
            exportValue,
            exportKey,
            childPath,
            exportTypes,
            exportToDist,
            matchedSubpath,
          )
        }
        continue
      }

      const childPath = isExportPath
        ? joinRelativePath(currentPath, exportKey)
        : currentPath

      if (!isExportPath) {
        exportTypes.add(exportKey)
      }

      collectExportPath(
        exportValue,
        exportKey,
        childPath,
        exportTypes,
        exportToDist,
      )
    }
  }

  if (typeof bins === 'string') {
    const outputConditionPair: [string, string] = [bins, defaultCondition]
    addToExportDistMap(exportToDist, BINARY_TAG, [outputConditionPair])
  } else {
    for (const binName of Object.keys(bins)) {
      const binDistPath = bins[binName]
      const exportType = getExportTypeFromFile(binDistPath, pkg.type)
      const exportPath = posix.join(BINARY_TAG, binName)
      const outputConditionPair: [string, string] = [binDistPath, exportType]
      addToExportDistMap(exportToDist, exportPath, [outputConditionPair])
    }
  }

  // Handle package.json global exports fields
  if (pkg.main || pkg.module || pkg.types) {
    const mainExportPath = pkg.main
    const moduleExportPath = pkg.module
    const typesEntryPath = pkg.types

    addToExportDistMap(
      exportToDist,
      './index',
      [
        Boolean(mainExportPath) && [
          mainExportPath,
          getMainFieldExportType(pkg),
        ],
        Boolean(moduleExportPath) && [moduleExportPath, 'module'],
        Boolean(typesEntryPath) && [typesEntryPath, 'types'],
      ].filter(Boolean) as [string, string][],
    )
  }

  return exportToDist
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
  return ['import', 'module', 'module-sync'].includes(name) || ext === 'mjs'
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

export function getFileExportType(composedTypes: string) {
  return composedTypes.split('.').pop() as string
}

export type ExportOutput = {
  format: OutputOptions['format']
  file: string
  exportCondition: string
}
export function getExportsDistFilesOfCondition(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
  dts: boolean,
): ExportOutput[] {
  const dist: ExportOutput[] = []
  const exportConditionNames = Object.keys(parsedExportCondition.export)
  const uniqueFiles = new Set<string>()
  for (const exportCondition of exportConditionNames) {
    const exportType = getFileExportType(exportCondition)
    // Filter out non-types field when generating types jobs
    if (dts && exportType !== 'types') {
      continue
    }
    // Filter out types field when generating asset jobs
    if (!dts && exportType === 'types') {
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
    dist.push({ format, file: distFile, exportCondition })
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
