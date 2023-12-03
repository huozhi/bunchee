import fs from 'fs/promises'
import path from 'path'
import { PackageMetadata } from './types'
import {
  availableExportConventions,
  availableExtensions,
  SRC,
} from './constants'
import { logger } from './logger'

export function exit(err: string | Error) {
  logger.error(err)
  process.exit(1)
}

export const formatDuration = (duration: number) =>
  duration >= 1000 ? `${duration / 1000}s` : `${duration}ms`

export async function hasPackageJson(cwd: string) {
  return await fileExists(path.resolve(cwd, 'package.json'))
}

export async function getPackageMeta(cwd: string): Promise<PackageMetadata> {
  const pkgFilePath = path.resolve(cwd, 'package.json')
  let targetPackageJson = {}
  try {
    targetPackageJson = JSON.parse(
      await fs.readFile(pkgFilePath, { encoding: 'utf-8' }),
    )
  } catch (_) {}

  return targetPackageJson
}

export function isTypescriptFile(filename: string): boolean {
  const ext = path.extname(filename)
  return ext === '.ts' || ext === '.tsx'
}

export async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw err
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

export async function findSourceEntryFile(
  cwd: string,
  exportPath: string,
  exportTypeSuffix: string | null,
  ext: string,
): Promise<string | undefined> {
  const filename = resolveSourceFile(
    cwd,
    `${exportPath}${exportTypeSuffix ? `.${exportTypeSuffix}` : ''}.${ext}`,
  )

  if (await fileExists(filename)) {
    return filename
  }

  const subFolderIndexFilename = resolveSourceFile(
    cwd,
    `${exportPath}/index${
      exportTypeSuffix ? `.${exportTypeSuffix}` : ''
    }.${ext}`,
  )

  if (await fileExists(subFolderIndexFilename)) {
    return subFolderIndexFilename
  }
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
    if (exportPath.endsWith('package.json')) return
    if (exportPath === '.') exportPath = './index'

    // Find convention-based source file for specific export types
    // $binary represents `pkg.bin`
    if (availableExportConventions.includes(exportType) && exportType !== '$binary') {
      const filename = await findSourceEntryFile(
        cwd,
        exportPath,
        exportType,
        ext,
      )
      if (filename) return filename
    }

    const filename = await findSourceEntryFile(cwd, exportPath, null, ext)
    if (filename) return filename
  }
  return
}

// Unlike path.basename, forcedly removing extension
export function filenameWithoutExtension(file: string | undefined) {
  return file
    ? file.replace(new RegExp(`${path.extname(file)}$`), '')
    : undefined
}

export const nonNullable = <T>(n?: T): n is T => Boolean(n)

export const fileExtension = (file: string | undefined) =>
  file ? path.extname(file).slice(1) : undefined

export const hasAvailableExtension = (filename: string): boolean =>
  availableExtensions.includes(path.extname(filename).slice(1))

export const hasCjsExtension = (filename: string): boolean =>
  path.extname(filename) === '.cjs'
