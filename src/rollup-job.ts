import {
  RollupBuild,
  RollupOutput,
  RollupWatchOptions,
  RollupWatcher,
  rollup,
  watch as rollupWatch,
} from 'rollup'

import { statSync } from 'fs'

import { buildEntryConfig } from './build-config'
import { buildMergedConfigs } from './rollup/merged-config'
import {
  BuildContext,
  BuncheeRollupConfig,
  BundleConfig,
  BundleJobOptions,
  MergedRollupConfig,
} from './types'
import { removeOutputDir } from './utils'
import { normalizeError } from './lib/normalize-error'
import { logger } from './logger'
import { endProfile, startProfile } from './lib/profile'

function inputCount(input: string | Record<string, string>): number {
  return typeof input === 'string' ? 1 : Object.keys(input).length
}

function graphKind(plugins: MergedRollupConfig['plugins']): 'dts' | 'js' {
  const pluginValue = plugins as unknown
  const pluginList: unknown[] = Array.isArray(pluginValue)
    ? pluginValue.flat(Infinity)
    : [pluginValue]
  return pluginList.some(
    (plugin) =>
      plugin != null &&
      typeof plugin === 'object' &&
      'name' in plugin &&
      plugin.name === 'dts',
  )
    ? 'dts'
    : 'js'
}

export async function createAssetRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const configStarted = startProfile()
  const { isFromCli, generateTypes } = bundleJobOptions
  const assetsConfigs = options._typesOnly
    ? []
    : await buildEntryConfig(options, buildContext, {
        dts: false,
        isFromCli,
      })
  const typesConfigs = generateTypes
    ? await buildEntryConfig(options, buildContext, {
        dts: true,
        isFromCli,
      })
    : []
  const allConfigs = assetsConfigs.concat(typesConfigs)
  endProfile('bundle.config', configStarted, {
    graphs: allConfigs.length,
    merged: false,
  })

  // When it's production build (non watch mode), we need to remove the output directory
  if (!options.watch) {
    const cleanStarted = startProfile()
    for (const config of allConfigs) {
      if (options.clean && !isFromCli) {
        await removeOutputDir(config.output, buildContext.cwd)
      }
    }
    endProfile('bundle.clean', cleanStarted, {
      enabled: Boolean(options.clean && !isFromCli),
    })
  }

  const rollupJobs = allConfigs.map((rollupConfig) =>
    bundleOrWatch(options, rollupConfig),
  )

  try {
    return await Promise.all(rollupJobs)
  } catch (err: unknown) {
    const error = normalizeError(err)
    throw error
  }
}

/**
 * Build every entry through a handful of shared rollup instances instead of one
 * per entry/output pair: one module graph per group, written once per output.
 */
export async function createMergedRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const configStarted = startProfile()
  const { isFromCli, generateTypes } = bundleJobOptions
  const assetsConfigs = options._typesOnly
    ? []
    : await buildMergedConfigs(options, buildContext, {
        dts: false,
        isFromCli,
      })
  const typesConfigs = generateTypes
    ? await buildMergedConfigs(options, buildContext, { dts: true, isFromCli })
    : []
  const allConfigs = assetsConfigs.concat(typesConfigs)
  endProfile('bundle.config', configStarted, {
    graphs: allConfigs.length,
    merged: true,
  })

  // Clean every output directory before anything is written: the JS and types
  // groups usually share one dist directory, so cleaning per job would delete
  // an earlier job's output.
  if (options.clean && !isFromCli) {
    const cleanStarted = startProfile()
    for (const config of allConfigs) {
      for (const output of config.output) {
        await removeOutputDir(output, buildContext.cwd)
      }
    }
    endProfile('bundle.clean', cleanStarted, { enabled: true })
  }

  if (process.env.DEBUG) {
    const shape = allConfigs
      .map(
        (config) =>
          `${Object.keys(config.input).length} inputs -> ` +
          config.output.map((output) => output.format).join('+'),
      )
      .join(' | ')
    logger.log(
      `Building ${Object.keys(buildContext.entries).length} entries in ` +
        `${allConfigs.length} shared rollup instances: ${shape}`,
    )
  }

  try {
    // Sequentially: there are only a handful of graphs and each is large.
    // Running them concurrently puts every graph — including a full TypeScript
    // program — in one heap, which is both the OOM the per-entry path hits and,
    // measured, slower than doing them in turn. Parallelism across types shards
    // comes from the worker pool, where each shard gets its own heap.
    const results = []
    for (const config of allConfigs) {
      results.push(await runMergedBundle(config))
    }
    return results
  } catch (err: unknown) {
    throw normalizeError(err)
  }
}

async function runMergedBundle({
  output: outputs,
  ...restOptions
}: MergedRollupConfig) {
  let bundle: RollupBuild
  const debug = Boolean(process.env.DEBUG)
  const started = Date.now()
  const graphStarted = startProfile()
  const kind =
    graphStarted === undefined ? undefined : graphKind(restOptions.plugins)
  const inputs =
    graphStarted === undefined ? undefined : inputCount(restOptions.input)
  try {
    bundle = await rollup({ ...restOptions, cache: false })
  } catch (error) {
    endProfile('rollup.graph', graphStarted, {
      inputs,
      kind,
      status: 'error',
    })
    return catchErrorHandler(error)
  }
  endProfile('rollup.graph', graphStarted, {
    inputs,
    kind,
    status: 'success',
  })
  if (debug) {
    logMergedGraph(bundle, Object.keys(restOptions.input).length, started)
  }
  try {
    // One graph, written once per output: the parse and transform work behind it
    // is not repeated for the second format.
    const results = []
    for (const output of outputs) {
      const writeStart = Date.now()
      const writeProfileStarted = startProfile()
      try {
        results.push(await bundle.write(output))
      } finally {
        endProfile('rollup.write', writeProfileStarted, {
          format: output.format,
          kind,
        })
      }
      if (debug) {
        logger.log(`  write ${output.format}: ${Date.now() - writeStart}ms`)
      }
    }
    return results
  } finally {
    await bundle.close()
  }
}

/**
 * What actually landed in one merged graph. This is how an unintended entry
 * dragging in a large build-time-only dependency shows up — on a package where
 * a `_`-prefixed private module imports something like the TypeScript compiler,
 * that single module dominates the whole build.
 */
function logMergedGraph(
  bundle: RollupBuild,
  inputCount: number,
  startedAt: number,
) {
  logger.log(`  graph of ${inputCount} inputs: ${Date.now() - startedAt}ms`)
  const modules = bundle.watchFiles
    .filter((file) => !file.startsWith('\0'))
    .map((file) => ({
      file,
      size: statSync(file, { throwIfNoEntry: false })?.size ?? 0,
    }))
    .sort((a, b) => b.size - a.size)
  const fromNodeModules = modules.filter((m) => m.file.includes('node_modules'))
  const totalKb = Math.round(modules.reduce((sum, m) => sum + m.size, 0) / 1024)
  logger.log(
    `  ${modules.length} modules, ${fromNodeModules.length} from ` +
      `node_modules, ${totalKb}kB of source`,
  )
  for (const { file, size } of modules.slice(0, 3)) {
    logger.log(
      `    ${Math.round(size / 1024)}kB  ${file.split('node_modules/').pop()}`,
    )
  }
}

async function bundleOrWatch(
  options: BundleConfig,
  rollupConfig: BuncheeRollupConfig,
): Promise<RollupWatcher | RollupOutput | void> {
  if (options.watch) {
    return runWatch(rollupConfig)
  }
  return runBundle(rollupConfig)
}

async function runBundle({ output, ...restOptions }: BuncheeRollupConfig) {
  let bundle: RollupBuild
  const graphStarted = startProfile()
  const kind =
    graphStarted === undefined ? undefined : graphKind(restOptions.plugins)
  const inputs =
    graphStarted === undefined ? undefined : inputCount(restOptions.input)
  try {
    // One-shot builds never reuse the cache; disabling it stops rollup from
    // retaining every module's AST on the bundle for the rest of the build.
    bundle = await rollup({ ...restOptions, cache: false })
  } catch (error) {
    endProfile('rollup.graph', graphStarted, {
      inputs,
      kind,
      status: 'error',
    })
    return catchErrorHandler(error)
  }
  endProfile('rollup.graph', graphStarted, {
    inputs,
    kind,
    status: 'success',
  })
  try {
    const writeStarted = startProfile()
    try {
      return await bundle.write(output)
    } finally {
      endProfile('rollup.write', writeStarted, {
        format: output.format,
        kind,
      })
    }
  } finally {
    // Release module graph and plugin resources once the assets are written,
    // instead of holding every entry's graph until the whole build finishes.
    await bundle.close()
  }
}

function runWatch({
  output,
  ...restOptions
}: BuncheeRollupConfig): RollupWatcher {
  const watchOptions: RollupWatchOptions[] = [
    {
      ...restOptions,
      output: output,
      watch: {
        exclude: ['node_modules/**'],
      },
    },
  ]
  const watcher = rollupWatch(watchOptions)

  return watcher
}

function catchErrorHandler(error: any) {
  if (!error) return
  // filter out the rollup plugin error information such as loc/frame/code...
  const err = new Error(error.message)
  err.stack = error.stack
  throw error
}
