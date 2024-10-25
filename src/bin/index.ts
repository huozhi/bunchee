import type { CliArgs, BundleConfig, BuildContext } from '../types'
import path from 'path'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { performance } from 'perf_hooks'
import { lint as lintPackage } from '../lint'
import { exit, getPackageMeta, hasPackageJson } from '../utils'
import { logger } from '../logger'
import { version } from '../../package.json'
import { bundle } from '../../src/index'
import { prepare } from '../prepare'
import { RollupWatcher } from 'rollup'
import { logOutputState } from '../plugins/output-state-plugin'

const helpMessage = `
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -m, --minify           compress output. default: false
  -o, --output <file>    specify output filename
  -f, --format <format>  type of output (esm, amd, cjs, iife, umd, system), default: esm
  -h, --help             output usage information
  --prepare              auto configure package.json exports for building
  --external <mod>       specify an external dependency, separate by comma
  --no-external          do not bundle external dependencies
  --no-clean             do not clean dist folder before building, default: false
  --target <target>      js features target: swc target es versions. default: es2015
  --runtime <runtime>    build runtime (nodejs, browser). default: browser
  --env <env>            inlined process env variables, separate by comma. default: NODE_ENV
  --cwd <cwd>            specify current working directory
  --sourcemap            enable sourcemap generation, default: false
  --no-dts               do not generate types, default: undefined
  --tsconfig             path to tsconfig file, default: tsconfig.json
  --dts-bundle           bundle type declaration files, default: false
`

function help() {
  logger.log(helpMessage)
}

async function lint(cwd: string) {
  // Not package.json detected, skip package linting
  if (!(await hasPackageJson(cwd))) {
    return
  }
  await lintPackage(await getPackageMeta(cwd))
}

async function parseCliArgs(argv: string[]) {
  const args = await yargs(hideBin(argv))
    .option('cwd', {
      type: 'string',
      description: 'specify current working directory',
    })
    .option('dts', {
      coerce(arg) {
        return arg === false ? false : undefined
      },
      description: 'do not generate types',
    })
    .option('clean', {
      coerce(arg) {
        return arg === false ? false : undefined
      },
      description: 'do not clean dist folder before building',
    })
    .option('output', {
      type: 'string',
      alias: 'o',
      description: 'specify output filename',
    })
    .option('format', {
      type: 'string',
      alias: 'f',
      default: 'esm',
      description: 'type of output (esm, amd, cjs, iife, umd, system)',
    })
    .option('watch', {
      type: 'boolean',
      alias: 'w',
      description: 'watch src files changes',
    })
    .option('minify', {
      type: 'boolean',
      alias: 'm',
      description: 'compress output',
    })
    .option('help', {
      type: 'boolean',
      alias: 'h',
      description: 'output usage information',
    })
    .option('runtime', {
      type: 'string',
      default: 'browser',
      description: 'build runtime (nodejs, browser)',
    })
    .option('target', {
      type: 'string',
      description: 'js features target: swc target es versions',
    })
    .option('sourcemap', {
      type: 'boolean',
      default: false,
      description: 'enable sourcemap generation',
    })
    .option('env', {
      type: 'string',
      description: 'inlined process env variables, separate by comma',
    })
    .option('external', {
      coerce(arg) {
        return typeof arg === 'string' || typeof arg === 'boolean'
          ? arg
          : undefined
      },
      description: 'specify an external dependency, separate by comma',
    })
    .option('prepare', {
      type: 'boolean',
      description: 'auto configure package.json exports for building',
    })
    .option('tsconfig', {
      type: 'string',
      description: 'path to tsconfig file',
    })
    .option('dts-bundle', {
      type: 'boolean',
      description: 'bundle type declaration files',
    })
    .version(version)
    .help('help', 'output usage information')
    .showHelpOnFail(true)
    .parse()

  const source: string = args._[0] as string
  const parsedArgs: CliArgs = {
    source,
    format: args['format'] as CliArgs['format'],
    file: args['output'],
    watch: args['watch'],
    minify: args['minify'],
    sourcemap: !!args['sourcemap'],
    cwd: args['cwd'],
    dts: args['dts'] === false ? false : undefined,
    dtsBundle: args['dts-bundle'],
    help: args['help'],
    runtime: args['runtime'],
    target: args['target'] as CliArgs['target'],
    // no-external is a boolean flag, turning external to `false`
    external:
      args['external'] === false
        ? null
        : (args['external'] as CliArgs['external']),
    clean: args['clean'] !== false,
    env: args['env'],
    prepare: !!args['prepare'],
    tsconfig: args['tsconfig'],
  }
  return parsedArgs
}

type Spinner = {
  start: () => void
  stop: (text?: string) => void
}

async function run(args: CliArgs) {
  const {
    source,
    format,
    watch,
    minify,
    sourcemap,
    target,
    runtime,
    dts,
    dtsBundle,
    env,
    clean,
    tsconfig,
  } = args
  const cwd = args.cwd || process.cwd()
  const file = args.file ? path.resolve(cwd, args.file) : undefined
  const bundleConfig: BundleConfig = {
    dts: dts !== false && { respectExternal: dtsBundle ? true : undefined },
    file,
    format,
    cwd,
    target,
    runtime,
    external:
      args.external === null
        ? null
        : // args.external is boolean when --no-external is passed
          args.external?.split(',') || [],
    watch: !!watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
    env: env?.split(',') || [],
    clean,
    tsconfig,
  }
  if (args.prepare) {
    return await prepare(cwd)
  }

  const cliEntry = source ? path.resolve(cwd, source) : ''

  // lint package
  await lint(cwd)

  const { default: ora } = await import('ora')

  const oraInstance = ora({
    text: 'Building...\n\n',
    color: 'green',
  })

  const spinner: Spinner = {
    start: startSpinner,
    stop: stopSpinner,
  }

  function startSpinner() {
    oraInstance.start()
  }

  function stopSpinner(text?: string) {
    if (oraInstance.isSpinning) {
      oraInstance.clear()
      if (text) {
        oraInstance.stopAndPersist({
          symbol: '✔',
          text,
        })
      } else {
        oraInstance.stop()
      }
    }
  }

  let initialBuildContext: BuildContext | undefined
  function onBuildStart(buildContext: BuildContext) {
    initialBuildContext = buildContext
    if (!watch) {
      spinner.start()
    }
  }

  function onBuildEnd(assetJobs: RollupWatcher[]) {
    // Stop spinner before logging output files and sizes on build end
    if (watch) {
      logWatcherBuildTime(assetJobs, spinner)
    } else {
      stopSpinner()
      if (assetJobs.length === 0) {
        logger.warn(
          'The "src" directory does not contain any entry files. ' +
            'For proper usage, please refer to the following link: ' +
            'https://github.com/huozhi/bunchee#usage',
        )
      }

      const outputState = initialBuildContext?.pluginContext.outputState
      if (outputState) {
        logOutputState(outputState.getSizeStats())
      }
    }
  }

  let buildError: any
  bundleConfig._callbacks = {
    onBuildStart,
    onBuildEnd,
  }

  if (watch) {
    logger.log(`Watching project ${cwd}...`)
  }

  try {
    await bundle(cliEntry, bundleConfig)
  } catch (err: any) {
    if (err.name === 'NOT_EXISTED') {
      buildError = {
        digest: 'bunchee:not-existed',
        error: err,
      }
    }

    if (buildError?.digest === 'bunchee:not-existed') {
      help()
    } else {
      if (watch) {
        logError(err)
      } else {
        throw err
      }
    }
  }

  // watching mode
  if (watch) {
    spinner.stop()
  } else {
    spinner.stop(`bunchee ${version} build completed`)
  }
}

async function main() {
  let params, error
  try {
    params = await parseCliArgs(process.argv)
  } catch (err) {
    error = err
  }
  if (error || !params) {
    // if (!error) help()
    return exit(error as Error)
  }
  await run(params)
}

function logWatcherBuildTime(result: RollupWatcher[], spinner: Spinner) {
  let watcherCounter = 0
  let startTime = 0

  result.map((watcher) => {
    function start() {
      if (watcherCounter === 0) {
        startTime = performance.now()
        spinner.start()
      }
      watcherCounter++
    }
    function end() {
      watcherCounter--
      if (watcherCounter === 0) {
        spinner.stop(`Built in ${(performance.now() - startTime).toFixed(2)}ms`)
      }
    }
    ;(watcher as RollupWatcher).on('event', (event) => {
      switch (event.code) {
        case 'ERROR': {
          spinner.stop()
          logError(event.error)
          break
        }
        case 'START': {
          start()
          break
        }
        case 'END': {
          end()
          break
        }
        default:
          break
      }
    })
  })
}

function logError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stderr.write(error.frame + '\n')
  }
}

main().catch(exit)
