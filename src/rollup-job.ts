import {
  RollupBuild,
  RollupOutput,
  RollupWatchOptions,
  RollupWatcher,
  rollup,
  watch as rollupWatch,
} from 'rollup'

import { buildEntryConfig } from './build-config'
import {
  BuildContext,
  BuncheeRollupConfig,
  BundleConfig,
  BundleJobOptions,
} from './types'
import { removeOutputDir } from './utils'
import { normalizeError } from './lib/normalize-error'
import { runWithConcurrency } from './lib/concurrency'

// Default concurrency limit for DTS generation to prevent memory overflow.
// Each rollup-plugin-dts instance holds TypeScript program state in memory.
// Limiting concurrency allows V8 to GC between builds.
const DEFAULT_DTS_CONCURRENCY = 2

export async function createAssetRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const { isFromCli, generateTypes } = bundleJobOptions

  // Build configs in parallel - this is safe as configs are just objects
  const [assetsConfigs, typesConfigs] = await Promise.all([
    buildEntryConfig(options, buildContext, {
      dts: false,
      isFromCli,
    }),
    generateTypes
      ? buildEntryConfig(options, buildContext, {
          dts: true,
          isFromCli,
        })
      : Promise.resolve([]),
  ])

  const allConfigs = assetsConfigs.concat(typesConfigs)

  // When it's production build (non watch mode), we need to remove the output directory
  if (!options.watch) {
    for (const config of allConfigs) {
      if (options.clean && !isFromCli) {
        await removeOutputDir(config.output, buildContext.cwd)
      }
    }
  }

  try {
    // Run JS bundling in parallel (SWC is fast and memory-efficient)
    const jsResults = await Promise.all(
      assetsConfigs.map((config) => bundleOrWatch(options, config)),
    )

    // Run DTS generation with limited concurrency to prevent memory overflow.
    // Each rollup-plugin-dts instance holds TypeScript program state in memory.
    // Limiting concurrency allows V8 to garbage collect between builds.
    const dtsResults = await runWithConcurrency(
      typesConfigs.map((config) => () => bundleOrWatch(options, config)),
      DEFAULT_DTS_CONCURRENCY,
    )

    return [...jsResults, ...dtsResults]
  } catch (err: unknown) {
    const error = normalizeError(err)
    throw error
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

function runBundle({ output, ...restOptions }: BuncheeRollupConfig) {
  return rollup(restOptions).then((bundle: RollupBuild) => {
    return bundle.write(output)
  }, catchErrorHandler)
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
