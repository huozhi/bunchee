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
  getMainFieldExportType,
  isESModulePackage,
  joinRelativePath,
} from './utils'
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
    exportTypes.add(exportKey.startsWith('./') ? 'default' : exportKey)
    const exportInfo = exportToDist.get(currentPath)
    const exportCondition = Array.from(exportTypes).join('.')
    if (!exportInfo) {
      const outputConditionPair: [string, string] = [
        exportValue,
        exportCondition,
      ]
      exportToDist.set(currentPath, [outputConditionPair])
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

/**
 * parseExports - parse package.exports field and other fields like main,module to a map
 *
 * map from export path to output path and export conditions
 */
export function parseExports(pkg: PackageMetadata): ParsedExportsInfo {
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

  if (pkg.main || pkg.module) {
    const mainExportPath = pkg.main
    const moduleExportPath = pkg.module
    const typesEntryPath = pkg.types
    const existingExportInfo = exportToDist.get('.')
    exportToDist.set(
      '.',
      [
        ...(existingExportInfo || []),
        [mainExportPath, getMainFieldExportType(pkg)],
        Boolean(moduleExportPath) && [moduleExportPath, 'import'],
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

export type ExportOutput = {
  format: OutputOptions['format']
  file: string
  exportCondition: string
}
export function getExportsDistFilesOfCondition(
  pkg: PackageMetadata,
  parsedExportCondition: ParsedExportCondition,
  cwd: string,
): ExportOutput[] {
  const dist: ExportOutput[] = []
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
