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

  for (const config of assetsConfigs) {
    if (options.clean && !isFromCli) {
      await removeOutputDir(config.output, buildContext.cwd)
    }
  }

  const rollupJobs = assetsConfigs.map((rollupConfig) =>
    bundleOrWatch(options, rollupConfig),
  )

  const rolldownJobs = typesConfigs.map((rolldownConfig) => {
    const external = rolldownConfig.input.external
    // delete rolldownConfig.input.external
    rolldownConfig.input.external = undefined
    // @ts-ignore migrate external
    rolldownConfig.external = external
    const plugins = rolldownConfig.input.plugins
    // delete rolldownConfig.input.plugins
    rolldownConfig.input.plugins = undefined
    // @ts-ignore migrate plugins
    rolldownConfig.plugins = plugins
    const onwarn = rolldownConfig.input.onwarn
    rolldownConfig.input.onwarn = undefined
    // @ts-ignore migrate onwarn
    rolldownConfig.onwarn = onwarn

    // @ts-ignore migrate input
    rolldownConfig.input = rolldownConfig.input.input
    // migrate output
    delete rolldownConfig.output.manualChunks
    delete rolldownConfig.output.interop
    delete rolldownConfig.output.freeze
    delete rolldownConfig.output.strict

    return rolldownBuild(rolldownConfig as any)
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
