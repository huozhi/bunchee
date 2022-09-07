import fs from 'fs'
import path from 'path'
import type { PackageMetadata } from './types'

export function exit(err: string | Error) {
  logger.error(err)
  process.exit(1)
}

export function getPackageMeta(cwd: string): PackageMetadata {
  const pkgFilePath = path.resolve(cwd, 'package.json')
  let targetPackageJson = {}
  try {
    targetPackageJson = JSON.parse(fs.readFileSync(pkgFilePath, { encoding: 'utf-8' }))
  } catch (_) {}

  return targetPackageJson
}

export const logger = {
  log(arg: any) {
    console.log(arg)
  },
  warn(arg: any[]) {
    console.log('\x1b[33m' + arg + '\x1b[0m')
  },
  error(arg: any) {
    console.error('\x1b[31m' + arg + '\x1b[0m')
  },
}

export function isTypescript(filename: string): boolean {
  const ext = path.extname(filename)
  return ext === '.ts' || ext === '.tsx'
}

export const isNotNull = <T>(n: T | false): n is T => Boolean(n)