import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { PackageMetadata } from './types'
import {
  runtimeExportConventions,
  availableExtensions,
  SRC,
  tsExtensions,
  optimizeConventions,
  BINARY_TAG,
} from './constants'
import { logger } from './logger'
import { type OutputOptions } from 'rollup'
import { posixRelativify } from './lib/format'

export function exit(err: string | Error) {
  logger.error(err)
  process.exit(1)
}

export const formatDuration = (duration: number) =>
  duration >= 1000 ? `${duration / 1000}s` : `${duration}ms`

export function hasPackageJson(cwd: string) {
  return fileExists(path.resolve(cwd, 'package.json'))
}

export async function getPackageMeta(cwd: string): Promise<PackageMetadata> {
  const pkgFilePath = path.resolve(cwd, 'package.json')
  let targetPackageJson = {}
  try {
    targetPackageJson = JSON.parse(
      await fsp.readFile(pkgFilePath, { encoding: 'utf-8' }),
    )
  } catch (_) {}

  return targetPackageJson
}

export function isTypescriptFile(filename: string): boolean {
  const ext = path.extname(filename).slice(1)
  return tsExtensions.has(ext)
}

export function fileExists(filePath: string) {
  return fs.existsSync(filePath)
}

// . -> pkg name
// ./lite -> <pkg name>/lite
export function getExportPath(
  pkg: PackageMetadata,
  cwd: string,
  exportName?: string,
) {
  const name = pkg.name || path.basename(cwd)
  if (exportName === '.' || !exportName) return name
  return path.join(name, exportName)
}

export const isNotNull = <T>(n: T | false): n is T => Boolean(n)

export function resolveSourceFile(cwd: string, filename: string) {
  return path.resolve(cwd, SRC, filename)
}

export function findSourceEntryFile(
  cwd: string,
  exportPath: string,
  exportTypeSuffix: string | null,
  ext: string,
): string | undefined {
  const filename = resolveSourceFile(
    cwd,
    `${exportPath}${exportTypeSuffix ? `.${exportTypeSuffix}` : ''}.${ext}`,
  )

  if (fileExists(filename)) {
    return filename
  }

  const subFolderIndexFilename = resolveSourceFile(
    cwd,
    `${exportPath}/index${
      exportTypeSuffix ? `.${exportTypeSuffix}` : ''
    }.${ext}`,
  )
  try {
    if (fileExists(subFolderIndexFilename)) {
      return subFolderIndexFilename
    }
  } catch {}
  return undefined
}

// Map '.' -> './index.[ext]'
// Map './lite' -> './lite.[ext]'
// Return undefined if no match or if it's package.json exports
export async function getSourcePathFromExportPath(
  cwd: string,
  exportPath: string,
  exportType: string,
): Promise<string | undefined> {
  for (const ext of availableExtensions) {
    // ignore package.json
    if (exportPath === '/package.json') return
    if (exportPath === '.') exportPath = './index'

    // Find convention-based source file for specific export types
    // $binary represents `pkg.bin`
    if (runtimeExportConventions.has(exportType) && exportType !== BINARY_TAG) {
      const filename = await findSourceEntryFile(
        cwd,
        exportPath,
        exportType,
        ext,
      )
      if (filename) return filename
    }
    const [, optimizeType] = exportType.split('.')
    if (optimizeConventions.has(optimizeType)) {
      const filename = await findSourceEntryFile(
        cwd,
        exportPath,
        optimizeType,
        ext,
      )
      if (filename) return filename
    }

    const filename = await findSourceEntryFile(cwd, exportPath, null, ext)
    if (filename) return filename
  }
  return
}

// TODO: add unit test
// Unlike path.basename, forcedly removing extension
export function filePathWithoutExtension(filePath: string | undefined) {
  if (!filePath) return ''

  const lastDotIndex = filePath.lastIndexOf('.')
  const lastSlashIndex = filePath.lastIndexOf('/')

  if (lastDotIndex !== -1 && lastDotIndex > lastSlashIndex) {
    return filePath.slice(0, filePath.indexOf('.', lastSlashIndex + 1))
  }

  return filePath
}

// 'index.server.js' -> 'index'
export const getFileBasename = (str: string) => str.split('.')[0]

export const nonNullable = <T>(n?: T): n is T => Boolean(n)

export const fileExtension = (file: string | undefined) =>
  file ? path.extname(file).slice(1) : undefined

export const hasAvailableExtension = (filename: string): boolean =>
  availableExtensions.has(path.extname(filename).slice(1))

export const hasCjsExtension = (filename: string): boolean =>
  path.extname(filename) === '.cjs'

export const getMainFieldExportType = (pkg: PackageMetadata) => {
  const isEsmPkg = isESModulePackage(pkg.type)
  const mainExportType =
    isEsmPkg && pkg.main
      ? hasCjsExtension(pkg.main)
        ? 'require'
        : 'import'
      : 'require'
  return mainExportType
}

// TODO: add unit test
export const baseNameWithoutExtension = (filename: string): string =>
  path.basename(filename, path.extname(filename))

export const isTestFile = (filename: string): boolean =>
  /\.(test|spec)$/.test(baseNameWithoutExtension(filename))

export function joinRelativePath(...segments: string[]) {
  let result = path.join(...segments)
  // If the first segment starts with '.', ensure the result does too.
  if (segments[0] === '.' && !result.startsWith('.')) {
    result = './' + result
  }
  return result
}

export function isESModulePackage(packageType: string | undefined) {
  return packageType === 'module'
}

async function removeDir(dirPath: string) {
  try {
    const dirStat = await fsp.stat(dirPath)
    if (dirStat.isDirectory()) {
      await fsp.rm(dirPath, { recursive: true, force: true })
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
}

const removedDirs = new Set<string>()
export async function removeOutputDir(output: OutputOptions, cwd: string) {
  const dir = output.dir
  if (
    dir &&
    // not equal to cwd
    dir !== cwd &&
    // not equal to src/ dir
    dir !== path.resolve(cwd, SRC) &&
    !removedDirs.has(dir)
  ) {
    await removeDir(dir)
    removedDirs.add(dir)
  }
}

export function isBinExportPath(exportPath: string) {
  return exportPath === BINARY_TAG || exportPath.startsWith(BINARY_TAG + '/')
}

export function isTypeFile(filename: string) {
  return (
    filename.endsWith('.d.ts') ||
    filename.endsWith('.d.mts') ||
    filename.endsWith('.d.cts')
  )
}

// shared.ts -> ./shared
// shared.<export condition>.ts -> ./shared.<export condition>
// index.ts -> ./index
// index.development.ts -> ./index.development
// foo/index.ts -> ./foo
export function sourceFilenameToExportFullPath(filename: string) {
  const ext = path.extname(filename)
  const exportPath = filename.slice(0, -ext.length)

  return posixRelativify(exportPath)
}

// If the file is matching the private module convention file export path.
// './lib/_foo' -> true
// './_util/index' -> true
// './lib/_foo/bar' -> true
// './foo' -> false
export function isPrivateExportPath(exportPath: string) {
  return /\/_/.test(exportPath)
}
