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
  try {
    // One-shot builds never reuse the cache; disabling it stops rollup from
    // retaining every module's AST on the bundle for the rest of the build.
    bundle = await rollup({ ...restOptions, cache: false })
  } catch (error) {
    return catchErrorHandler(error)
  }
  try {
    return await bundle.write(output)
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
