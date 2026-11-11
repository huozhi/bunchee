import { posix } from 'path'
import type {
  Entries,
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

/**
 * Every output file a single entry produces, as `{ file, format, target }`.
 */
export async function getEntryBundleOutputs(
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  pluginContext: BuildContext,
  bundleEntryOptions: bundleEntryOptions,
): Promise<ExportOutput[]> {
  const { file } = bundleConfig
  const { pkg, cwd } = pluginContext
  const { dts, isFromCli } = bundleEntryOptions

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
    const file = join(cwd, 'dist/index.js'.replace('/', path.sep))
    outputExports.push({
      format: defaultFormat,
      file,
      target: { path: file, conditions: ['default'] },
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
          target: { path: absoluteTypeFile, conditions: ['types'] },
        },
      ]
    } else {
      const fallbackExport = outputExports[0]
      bundleOptions = [
        {
          file: absoluteFile,
          format: bundleConfig.format || fallbackExport.format,
          target: { ...fallbackExport.target, path: absoluteFile },
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
          format: 'esm' as const,
          target: { path: typeFile, conditions: ['types'] },
        }
      })
    } else {
      bundleOptions = outputExports.map((exportDist) => {
        return {
          file: resolve(cwd, exportDist.file),
          format: exportDist.format,
          target: exportDist.target,
        }
      })
    }
  }

  return bundleOptions
}
