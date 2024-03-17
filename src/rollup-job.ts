import {
  OutputOptions,
  RollupBuild,
  RollupOutput,
  RollupWatchOptions,
  RollupWatcher,
  rollup,
  watch as rollupWatch,
} from 'rollup'

import { buildEntryConfig } from './build-config'
import { BuildContext, BuncheeRollupConfig, BundleConfig } from './types'
import { removeDir } from './utils'
import { logger } from './logger'

export async function createAssetRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
) {
  const assetsJobs = (await buildEntryConfig(options, buildContext, false)).map(
    (rollupConfig) =>
      bundleOrWatch(options, rollupConfig, false, buildContext.cwd),
  )
  const result = await Promise.all(assetsJobs)
  if (result.length === 0) {
    logger.warn(
      'The "src" directory does not contain any entry files. ' +
        'For proper usage, please refer to the following link: ' +
        'https://github.com/huozhi/bunchee#usage',
    )
  }
  return result
}

export async function createTypesRollupJobs(
  options: BundleConfig,
  buildContext: BuildContext,
) {
  const typesJobs = (await buildEntryConfig(options, buildContext, true)).map(
    (rollupConfig) =>
      bundleOrWatch(options, rollupConfig, false, buildContext.cwd),
  )
  return await Promise.all(typesJobs)
}

async function bundleOrWatch(
  options: BundleConfig,
  rollupConfig: BuncheeRollupConfig,
  isFromCli: boolean,
  cwd: string,
): Promise<RollupWatcher | RollupOutput | void> {
  if (options.clean) {
    if (!isFromCli) {
      await removeOutputDir(rollupConfig.output, cwd)
    }
  }

  if (options.watch) {
    return runWatch(rollupConfig)
  }
  return runBundle(rollupConfig)
}

async function removeOutputDir(output: OutputOptions, cwd: string) {
  const dir = output.dir
  if (dir && dir !== cwd) await removeDir(dir)
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
