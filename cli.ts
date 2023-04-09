#!/usr/bin/env node

import type { CliArgs, BundleConfig } from './src/types'

import path from 'path'
import arg from 'arg'
import { logger, exit, formatDuration, getPackageMeta } from './src/utils'
import { version } from './package.json'

// TODO: add more usage for `bunchee` without options

const helpMessage = `
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -m, --minify           compress output. default: false
  -o, --output <file>    specify output filename
  -f, --format <format>  type of output (esm, amd, cjs, iife, umd, system), default: esm
  -h, --help             output usage information
  --external <mod>       specify an external dependency, separate by comma
  --no-external          do not bundle external dependencies
  --target <target>      js features target: swc target es versions. default: es2016
  --runtime <runtime>    build runtime (nodejs, browser). default: browser
  --env <env>            inlined process env variables, separate by comma. default: NODE_ENV
  --cwd <cwd>            specify current working directory
  --sourcemap            enable sourcemap generation, default: false
  --dts                  determine if need to generate types, default: false
`

function help() {
  logger.log(helpMessage)
}

async function lintPackage(cwd: string) {
  const { publint } = await import('publint')
  const { printMessage } = await import('publint/utils')

  const messages = await publint({
    pkgDir: cwd,
    level: 'error',
  })

  const pkg = getPackageMeta(cwd)
  for (const message of messages) {
    console.log(printMessage(message, pkg))
  }
}

function parseCliArgs(argv: string[]) {
  let args: arg.Result<any> | undefined
  args = arg(
    {
      '--cwd': String,
      '--dts': Boolean,
      '--output': String,
      '--format': String,
      '--watch': Boolean,
      '--minify': Boolean,
      '--help': Boolean,
      '--version': Boolean,
      '--runtime': String,
      '--target': String,
      '--sourcemap': Boolean,
      '--env': String,
      '--external': String,
      '--no-external': Boolean,

      '-h': '--help',
      '-v': '--version',
      '-w': '--watch',
      '-o': '--output',
      '-f': '--format',
      '-m': '--minify',
    },
    {
      permissive: true,
      argv,
    }
  )
  const source: string = args._[0]
  const parsedArgs: CliArgs = {
    source,
    format: args['--format'],
    file: args['--output'],
    watch: args['--watch'],
    minify: args['--minify'],
    sourcemap: !!args['--sourcemap'],
    cwd: args['--cwd'],
    dts: args['--dts'],
    help: args['--help'],
    version: args['--version'],
    runtime: args['--runtime'],
    target: args['--target'],
    external: !!args['--no-external'] ? null : args['--external'],
    env: args['--env'],
  }
  return parsedArgs
}

async function run(args: CliArgs) {
  const { source, format, watch, minify, sourcemap, target, runtime, dts, env } = args
  const cwd = args.cwd || process.cwd()
  const file = args.file ? path.resolve(cwd, args.file) : undefined
  const bundleConfig: BundleConfig = {
    dts,
    file,
    format,
    cwd,
    target,
    runtime,
    external: args.external?.split(',') || [],
    watch: !!watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
    env: env?.split(',') || [],
  }
  if (args.version) {
    return logger.log(version)
  }
  if (args.help) {
    return help()
  }

  const entry = source ? path.resolve(cwd, source) : ''
  const bundle: typeof import('./lib').bundle = require('./lib').bundle

  let timeStart = Date.now()
  let timeEnd
  try {
    await bundle(entry, bundleConfig)
    timeEnd = Date.now()
  } catch (err: any) {
    if (err.name === 'NOT_EXISTED') {
      help()
      return exit(err)
    }
    throw err
  }

  const duration = timeEnd - timeStart
  // watching mode
  if (watch) {
    logger.log(`🔍  Watching assets in ${cwd}...`)
    return
  }

  // build mode
  logger.log(`✨  Finished in ${formatDuration(duration)}`)

  await lintPackage(cwd)
}

async function main() {
  let params, error
  try {
    params = parseCliArgs(process.argv.slice(2))
  } catch (err) {
    error = err
  }
  if (error || !params) {
    if (!error) help()
    return exit(error as Error)
  }
  await run(params)
}

main().catch(exit)
