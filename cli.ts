#!/usr/bin/env node

import type { CliArgs } from './src/types'

import path from 'path'
import arg from 'arg'
import { logger, exit } from './src/utils'
import { version } from './package.json'

const helpMessage = `
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -m, --minify           compress output. false by default
  -o, --output <file>    specify output filename
  -f, --format <format>  specify bundle type: "esm", "cjs", "umd". "esm" by default
  -e, --external <mod>   specify an external dependency
  -h, --help             output usage information
  --target <target>      js features target: swc target es versions. "es5" by default
  --runtime <runtime>    build runtime: "nodejs", "browser". "browser" by default
  --cwd <cwd>            specify current working directory
  --sourcemap            enable sourcemap generation, false by default
  --dts                  determine if need to generate types, false by default
`

function help() {
  logger.log(helpMessage)
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
    dts: !!args['--dts'],
    help: args['--help'],
    version: args['--version'],
    runtime: args['--runtime'],
    target: args['--target'],
    external: args['--external'],
  }
  return parsedArgs
}

async function run(args: any) {
  const { source, format, watch, minify, sourcemap, target, runtime, dts } = args
  const cwd = args.cwd || process.cwd()
  const file = args.file ? path.resolve(cwd, args.file) : undefined
  const cliArgs: CliArgs = {
    dts,
    file,
    format,
    cwd,
    target,
    runtime,
    external: args.external || [],
    watch: !!watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
  }
  if (args.version) {
    return logger.log(version)
  }
  if (args.help) {
    return help()
  }

  const entry = source ? path.resolve(cwd, source) : ''
  const { bundle } = require('./lib') as typeof import('./lib')

  let timeStart = Date.now()
  let timeEnd
  try {
    await bundle(entry, cliArgs)
    timeEnd = Date.now()
  } catch (err: any) {
    if (err.name === 'NOT_EXISTED') {
      help()
      return exit(err)
    }
    throw err
  }

  const duration = timeEnd - timeStart
  if (!watch) {
    logger.log(`✅ Finished in ${duration} ms`)
  }
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
