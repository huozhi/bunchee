import { posix } from 'path'
import type {
  Entries,
  BuncheeRollupConfig,
  BundleConfig,
  ParsedExportCondition,
  bundleEntryOptions,
} from './types'
import type { OutputOptions } from 'rollup'

import path, { resolve, join } from 'path'
import {
  getExportsDistFilesOfCondition,
  getExportFileTypePath,
  ExportOutput,
} from './exports'
import { isESModulePackage } from './utils'
import { BuildContext } from './types'
import {
  getSpecialExportTypeFromComposedExportPath,
  normalizeExportPath,
} from './entries'
import { buildInputConfig } from './rollup/input'
import { buildOutputConfigs } from './rollup/output'

// Avoid create multiple dts plugins instance and parsing the same tsconfig multi times,
// This will avoid memory leak and performance issue.

/**
 * return {
 *   <absolute source path>: <pkg>/<export>
 * }
 */
export function getReversedAlias({
  entries,
  name,
}: {
  entries: Entries
  name: string | undefined
}) {
  const alias: Record<string, string> = {}
  for (const [entryExportPath, exportCondition] of Object.entries(entries)) {
    const normalizedExportPath = normalizeExportPath(entryExportPath)
    // entryExportPath format: ./index, ./shared, etc.
    const specialExportType =
      getSpecialExportTypeFromComposedExportPath(entryExportPath)
    if (specialExportType === 'default') {
      alias[exportCondition.source] = posix.join(
        name || '',
        normalizedExportPath,
      )
    }
  }
  return alias
}

export async function buildEntryConfig(
  bundleConfig: BundleConfig,
  pluginContext: BuildContext,
  bundleEntryOptions: bundleEntryOptions,
): Promise<BuncheeRollupConfig[]> {
  const configs: BuncheeRollupConfig[] = []
  const { entries } = pluginContext
  for (const exportCondition of Object.values(entries)) {
    const rollupConfigs = await buildConfig(
      bundleConfig,
      exportCondition,
      pluginContext,
      bundleEntryOptions,
    )
    configs.push(...rollupConfigs)
  }
  return configs
}

async function buildRollupConfigs(
  entry: string,
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
): Promise<BuncheeRollupConfig> {
  const inputOptions = await buildInputConfig(
    entry,
    bundleConfig,
    exportCondition,
    buildContext,
    dts,
  )

  const outputOptions = await buildOutputConfigs(
    bundleConfig,
    exportCondition,
    buildContext,
    dts,
  )

  const { input, external, plugins, treeshake, onwarn } = inputOptions

  return {
    input,
    external,
    plugins,
    treeshake,
    onwarn,
    output: outputOptions,
  }
}

async function buildConfig(
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  pluginContext: BuildContext,
  bundleEntryOptions: bundleEntryOptions,
): Promise<BuncheeRollupConfig[]> {
  const { file } = bundleConfig
  const { pkg, cwd } = pluginContext
  const { dts, isFromCli } = bundleEntryOptions
  const entry = exportCondition.source

  const outputExports = getExportsDistFilesOfCondition(
    pkg,
    exportCondition,
    cwd,
    dts,
  )

  // If it's CLI generation for JS asset and there's nothing found,
  // give a default output dist/index.js.
  // We don't do it for types generation or non-CLI bundle generation.
  if (!dts && isFromCli && outputExports.length === 0 && !pkg.bin) {
    const isEsmPkg = isESModulePackage(pkg.type)
    const defaultFormat: OutputOptions['format'] = isEsmPkg ? 'esm' : 'cjs'
    outputExports.push({
      format: defaultFormat,
      file: join(cwd, 'dist/index.js'.replace('/', path.sep)),
      exportCondition: 'default',
    })
  }
  let bundleOptions: ExportOutput[] = []

  if (file) {
    const absoluteFile = resolve(cwd, file)
    const absoluteTypeFile = getExportFileTypePath(absoluteFile)
    if (dts) {
      bundleOptions = [
        {
          file: absoluteTypeFile,
          format: 'esm',
          exportCondition: 'types',
        },
      ]
    } else {
      const fallbackExport = outputExports[0]
      bundleOptions = [
        {
          file: absoluteFile,
          format: bundleConfig.format || fallbackExport.format,
          exportCondition: fallbackExport.exportCondition,
        },
      ]
    }
  } else {
    // CLI output option is always prioritized
    if (dts) {
      // types could have duplicates, dedupe them
      // e.g. { types, import, .. } use the same `types` condition with all conditions
      const uniqTypes = new Set<string>()
      outputExports.forEach((exportDist) => {
        uniqTypes.add(resolve(cwd, exportDist.file))
      })

      bundleOptions = Array.from(uniqTypes).map((typeFile) => {
        return {
          file: typeFile,
          format: 'esm',
          exportCondition: 'types',
        }
      })
    } else {
      bundleOptions = outputExports.map((exportDist) => {
        return {
          file: resolve(cwd, exportDist.file),
          format: exportDist.format,
          exportCondition: exportDist.exportCondition,
        }
      })
    }
  }

  const outputConfigs = bundleOptions.map(async (bundleOption) => {
    const targetExportCondition = {
      ...exportCondition,
      export: {
        [bundleOption.exportCondition]:
          bundleOption.exportCondition === 'types'
            ? bundleOption.file
            : exportCondition.export[bundleOption.exportCondition],
      },
    }
    return await buildRollupConfigs(
      entry,
      {
        ...bundleConfig,
        file: bundleOption.file,
        format: bundleOption.format,
      },
      targetExportCondition,
      pluginContext,
      dts,
    )
  })

  return Promise.all(outputConfigs)
}
