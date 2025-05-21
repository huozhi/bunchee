import {
  RollupBuild,
  RollupOutput,
  RollupWatchOptions,
  RollupWatcher,
  rollup,
  watch as rollupWatch,
} from 'rollup'
import { build as rolldownBuild } from 'rolldown'
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
  // const allConfigs = assetsConfigs // .concat(typesConfigs)

  for (const config of assetsConfigs) {
    if (options.clean && !isFromCli) {
      await removeOutputDir(config.output, buildContext.cwd)
    }
  }

  const rollupJobs = assetsConfigs.map((rollupConfig) =>
    bundleOrWatch(options, rollupConfig),
  )

  const rolldownJobs = typesConfigs.map((rollupConfig) => {
    console.log('rolldown')
    // const { build: rolldownBuild } = require('rolldown')
    console.log('rollupConfig', rollupConfig)
    return rolldownBuild(rollupConfig as any)
  })

  try {
    await Promise.all(rolldownJobs)
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

function runBundle({ input, output }: BuncheeRollupConfig) {
  return rollup(input).then((bundle: RollupBuild) => {
    return bundle.write(output)
  }, catchErrorHandler)
}

function runWatch({ input, output }: BuncheeRollupConfig): RollupWatcher {
  const watchOptions: RollupWatchOptions[] = [
    {
      ...input,
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
