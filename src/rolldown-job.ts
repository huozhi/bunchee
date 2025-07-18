import {
  build as rolldownBuild,
  type RolldownOutput,
  type RolldownOptions,
} from 'rolldown'
import type {
  BuildContext,
  BuncheeRollupConfig,
  BundleConfig,
  BundleJobOptions,
} from './types'
import { buildEntryConfig } from './build-config'
import { removeOutputDir } from './utils'
import { normalizeError } from './lib/normalize-error'

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
    rollupConfig.output.inlineDynamicImports = true
    delete rollupConfig.output.chunkFileNames
    delete rollupConfig.output.manualChunks

    return bundleRolldown(rollupConfig)
  })

  try {
    return await Promise.all(rolldownJobs)
  } catch (err: unknown) {
    const error = normalizeError(err)
    throw error
  }
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

  try {
    // rolldownBuild takes input and output options together
    const buildOptions = {
      ...rolldownOptions,
      output: {
        // file: outputFile,
        dir: output.dir,
        // inlineDynamicImports: true,
        format: output.format as any,
        sourcemap: output.sourcemap,
      },
    }

    return await rolldownBuild(buildOptions)
  } catch (error: any) {
    // Handle rolldown specific errors
    const err = new Error(error.message)
    err.stack = error.stack
    throw err
  }
}
