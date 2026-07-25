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
import { DEFAULT_BUILD_CONCURRENCY } from './constants'

export async function createAssetRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const { isFromCli, generateTypes } = bundleJobOptions
  const assetsConfigs = await buildEntryConfig(options, buildContext, {
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

  // When it's production build (non watch mode), we need to remove the output directory
  if (!options.watch) {
    for (const config of allConfigs) {
      if (options.clean && !isFromCli) {
        await removeOutputDir(config.output, buildContext.cwd)
      }
    }
  }

  try {
    // Watchers never settle, so pooling them would stall the build. Only the
    // one-shot build is capped.
    if (options.watch) {
      return await Promise.all(
        allConfigs.map((rollupConfig) => bundleOrWatch(options, rollupConfig)),
      )
    }

    return await runWithConcurrency(
      allConfigs.map(
        (rollupConfig) => () => bundleOrWatch(options, rollupConfig),
      ),
      getBuildConcurrency(),
    )
  } catch (err: unknown) {
    const error = normalizeError(err)
    throw error
  }
}

function getBuildConcurrency(): number {
  const value = Number(process.env.BUNCHEE_CONCURRENCY)
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BUILD_CONCURRENCY
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
