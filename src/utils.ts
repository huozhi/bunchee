import fs from 'fs/promises'
import path from 'path'
import type { PackageMetadata } from './types'

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
    targetPackageJson = JSON.parse(await fs.readFile(pkgFilePath, { encoding: 'utf-8' }))
  } catch (_) {}

  return targetPackageJson
}

export const logger = {
  log(arg?: any) {
    console.log(arg)
  },
  warn(arg: any[]) {
    console.log('\x1b[33m' + arg + '\x1b[0m')
  },
  error(arg: any) {
    console.error('\x1b[31m' + arg + '\x1b[0m')
  },
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
export function getExportPath(pkg: PackageMetadata, cwd: string, exportName?: string) {
  const name = pkg.name || path.basename(cwd)
  if (exportName === '.' || !exportName) return name
  return path.join(name, exportName)
}

export const isNotNull = <T>(n: T | false): n is T => Boolean(n)

const SRC = 'src' // resolve from src/ directory
export function resolveSourceFile(cwd: string, filename: string) {
  return path.resolve(cwd, SRC, filename)
}
// Map '.' -> './index.[ext]'
// Map './lite' -> './lite.[ext]'
// Return undefined if no match or if it's package.json exports
export async function getSourcePathFromExportPath(cwd: string, exportPath: string): Promise<string | undefined> {
  const exts = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx']
  for (const ext of exts) {
    // ignore package.json
    if (exportPath.endsWith('package.json')) return
    if (exportPath === '.') exportPath = './index'
    const filename = resolveSourceFile(cwd, `${exportPath}.${ext}`)

    if (await fileExists(filename)) {
      return filename
    }
  }
  return
}

// Unlike path.basename, forcedly removing extension
export function filenameWithoutExtension(file: string | undefined) {
  return file
    ? file.replace(new RegExp(`${path.extname(file)}$`), '')
    : undefined
}