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
import { createRolldownDtsJobs } from './rolldown-job'

export async function createAssetAndTypeJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const { isFromCli, generateTypes } = bundleJobOptions

  // Generate assets using rollup
  const assetsConfigs = await buildEntryConfig(options, buildContext, {
    dts: false,
    isFromCli,
  })

  // When it's production build (non watch mode), we need to remove the output directory
  if (!options.watch) {
    for (const config of assetsConfigs) {
      if (options.clean && !isFromCli) {
        await removeOutputDir(config.output, buildContext.cwd)
      }
    }
  }

  const rollupJobs = assetsConfigs.map((rollupConfig) =>
    bundleOrWatch(options, rollupConfig),
  )

  // Generate types using rolldown
  const rolldownJobsPromises = generateTypes
    ? createRolldownDtsJobs(options, buildContext, bundleJobOptions)
    : Promise.resolve([])

  const [assetResults, typeResults] = await Promise.all([
    Promise.all(rollupJobs),
    rolldownJobsPromises,
  ])
  return [...assetResults, ...typeResults]
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
