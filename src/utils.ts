import fs from 'fs'
import arg from 'arg'
import path from 'path'
import config from './config'
import type { PackageMetadata } from './types'

export function exit(err: string | Error) {
  logger.error(err)
  process.exit(1)
}

export function getPackageMeta(): PackageMetadata {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json')
  let targetPackageJson = {}
  try {
    targetPackageJson = JSON.parse(fs.readFileSync(pkgFilePath, { encoding: 'utf-8' }))
  } catch (_) {}

  return targetPackageJson
}

export function resolvePackagePath(pathname: string): string {
  return path.resolve(config.rootDir, pathname)
}

export function parseCliArgs(argv: string[]) {
  let args: arg.Result<any> | undefined
  args = arg(
    {
      '--cwd': String,
      '--output': String,
      '--format': String,
      '--watch': Boolean,
      '--minify': Boolean,
      '--help': Boolean,
      '--version': Boolean,
      '--runtime': String,
      '--target': String,
      '--sourcemap': Boolean,
      '--external': [String],

      '-h': '--help',
      '-v': '--version',
      '-w': '--watch',
      '-o': '--output',
      '-f': '--format',
      '-m': '--minify',
      '-e': '--external',
    },
    {
      permissive: true,
      argv,
    }
  )
  const source: string = args._[0]
  const parsedArgs = {
    source,
    format: args['--format'],
    file: args['--output'],
    watch: args['--watch'],
    minify: args['--minify'],
    sourcemap: !!args['--sourcemap'],
    cwd: args['--cwd'],
    help: args['--help'],
    version: args['--version'],
    runtime: args['--runtime'],
    target: args['--target'],
    external: args['--external'],
  }
  return parsedArgs
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
