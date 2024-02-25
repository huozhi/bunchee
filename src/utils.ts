import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { rimraf } from 'rimraf'
import { PackageMetadata } from './types'
import {
  suffixedExportConventions,
  availableExtensions,
  SRC,
  tsExtensions,
  optimizeConventions,
} from './constants'
import { logger } from './logger'

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

export async function removeDir(dirPath: string) {
  try {
    const dirStat = await fsp.stat(dirPath)
    if (dirStat.isDirectory()) {
      await rimraf(dirPath)
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
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
    if (suffixedExportConventions.has(exportType) && exportType !== '$binary') {
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
  if (!filePath) return

  const lastDotIndex = filePath.lastIndexOf('.')
  const lastSlashIndex = filePath.lastIndexOf('/')

  if (lastDotIndex !== -1 && lastDotIndex > lastSlashIndex) {
    return filePath.slice(0, filePath.indexOf('.', lastSlashIndex + 1))
  }

  return filePath
}

export const nonNullable = <T>(n?: T): n is T => Boolean(n)

export const fileExtension = (file: string | undefined) =>
  file ? path.extname(file).slice(1) : undefined

export const hasAvailableExtension = (filename: string): boolean =>
  availableExtensions.has(path.extname(filename).slice(1))

export const hasCjsExtension = (filename: string): boolean =>
  path.extname(filename) === '.cjs'

// TODO: add unit test
export const baseNameWithoutExtension = (filename: string): string =>
  path.basename(filename, path.extname(filename))

export const isTestFile = (filename: string): boolean =>
  /\.(test|spec)$/.test(baseNameWithoutExtension(filename))

export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  resolver?: (...args: Parameters<T>) => string, // if you need specify a cache key
) => {
  const cache = new Map<string, ReturnType<T>>()
  return ((...args: Parameters<T>) => {
    const key = resolver ? resolver(...args) : JSON.stringify({ args })
    const existing = cache.get(key)
    if (existing !== undefined) {
      return existing
    }
    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

export function joinRelativePath(...segments: string[]) {
  let result = path.join(...segments)
  // If the first segment starts with '.', ensure the result does too.
  if (segments[0] === '.' && !result.startsWith('.')) {
    result = './' + result
  }
  return result
}
