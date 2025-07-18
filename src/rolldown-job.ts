import {
  build as rolldownBuild,
  type RolldownOutput,
  type RolldownOptions,
  type OutputOptions as RolldownOutputOptions,
} from 'rolldown'
import type {
  BuildContext,
  BuncheeRollupConfig,
  BundleConfig,
  BundleJobOptions,
} from './types'
import { buildEntryConfig } from './build-config'
import { removeOutputDir } from './utils'

export async function createRolldownDtsJobs(
  options: BundleConfig,
  buildContext: BuildContext,
  bundleJobOptions: BundleJobOptions,
) {
  const { isFromCli, generateTypes } = bundleJobOptions

  if (!generateTypes) {
    return []
  }

  const typesConfigs = await buildEntryConfig(options, buildContext, {
    dts: true,
    isFromCli,
  })

  // When it's production build (non watch mode), we need to remove the output directory
  if (!options.watch) {
    for (const config of typesConfigs) {
      if (options.clean && !isFromCli) {
        await removeOutputDir(config.output, buildContext.cwd)
      }
    }
  }

  const rolldownJobs = typesConfigs.map((rollupConfig) => {
    // remove incompatible options
    delete rollupConfig.output.chunkFileNames
    delete rollupConfig.output.manualChunks
    delete rollupConfig.output.interop
    delete rollupConfig.output.freeze
    delete rollupConfig.output.strict

    return bundleRolldown(rollupConfig)
  })

  return await Promise.all(rolldownJobs)
}

async function bundleRolldown(
  rollupConfig: BuncheeRollupConfig,
): Promise<RolldownOutput | void> {
  // Convert rollup config to rolldown config
  const { output, ...restOptions } = rollupConfig

  // Convert rollup plugins to rolldown compatible format
  const rolldownOptions: RolldownOptions = {
    input: restOptions.input,
    external: restOptions.external,
    plugins: restOptions.plugins,
    treeshake:
      restOptions.treeshake === 'recommended'
        ? true
        : typeof restOptions.treeshake === 'boolean'
          ? restOptions.treeshake
          : undefined,
    onwarn: restOptions.onwarn,
  }

  const buildOptions = {
    ...rolldownOptions,
    output: {
      ...(output as unknown as RolldownOutputOptions),
      inlineDynamicImports: true, // Force single file output
    },
  }

  return await rolldownBuild(buildOptions)
}
