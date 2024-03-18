import {
  RollupBuild,
  RollupOutput,
  RollupWatchOptions,
  RollupWatcher,
  rollup,
  watch as rollupWatch,
} from 'rollup'

import { buildEntryConfig } from './build-config'
import { BuildContext, BuncheeRollupConfig, BundleConfig } from './types'
import { removeOutputDir } from './utils'
import { logger } from './logger'

export async function createAssetRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  {
    isFromCli,
    generateTypes,
  }: {
    isFromCli: boolean
    generateTypes: boolean
  },
) {
  const assetsConfigs = await buildEntryConfig(options, buildContext, false)
  const typesConfigs = generateTypes
    ? await buildEntryConfig(options, buildContext, true)
    : []
  const allConfigs = assetsConfigs.concat(typesConfigs)

  for (const config of allConfigs) {
    if (options.clean && !isFromCli) {
      await removeOutputDir(config.output, buildContext.cwd)
    }
  }

  const rollupJobs = allConfigs.map((rollupConfig) =>
    bundleOrWatch(options, rollupConfig),
  )

  return await Promise.all(rollupJobs)
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
  logger.error(error)
  // filter out the rollup plugin error information such as loc/frame/code...
  const err = new Error(error.message)
  err.stack = error.stack
  throw err
}
