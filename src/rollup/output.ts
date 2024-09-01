import type { OutputOptions } from 'rollup'
import type {
  BuildContext,
  BundleConfig,
  ParsedExportCondition,
} from '../types'
import { createSplitChunks } from './split-chunks'
import { resolve, dirname, basename } from 'path'
import { filePathWithoutExtension, isESModulePackage } from '../utils'
import { getExportFileTypePath } from '../exports'

export async function buildOutputConfigs(
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
): Promise<OutputOptions> {
  const { format } = bundleConfig
  const {
    entries,
    pkg,
    // exportPaths,
    cwd,
    tsOptions: { tsCompilerOptions },
    pluginContext,
  } = buildContext
  // Add esm mark and interop helper if esm export is detected
  const useEsModuleMark = tsCompilerOptions?.esModuleInterop // hasEsmExport(exportPaths, tsCompilerOptions)
  const absoluteOutputFile = resolve(cwd, bundleConfig.file!)
  const isEsmPkg = isESModulePackage(pkg.type)
  const name = filePathWithoutExtension(absoluteOutputFile)
  const dtsFile = resolve(
    cwd,
    dts
      ? bundleConfig.file!
      : exportCondition.export.types ??
          getExportFileTypePath(bundleConfig.file!),
  )
  const typesDir = dirname(dtsFile)
  const jsDir = dirname(absoluteOutputFile!)
  const outputFile: string = dts ? dtsFile : absoluteOutputFile
  const entryFiles = new Set(
    Object.values(entries).map((entry) => entry.source),
  )

  // const inputOptions = await buildInputConfig(
  //   entry,
  //   bundleConfig,
  //   exportCondition,
  //   buildContext,
  //   dts,
  // )

  const outputOptions: OutputOptions = {
    name: pkg.name || name,
    dir: dts ? typesDir : jsDir,
    format,
    exports: 'named',
    esModule: useEsModuleMark || 'if-default-prop',
    interop: 'auto',
    freeze: false,
    strict: false,
    sourcemap: bundleConfig.sourcemap,
    manualChunks: createSplitChunks(
      pluginContext.moduleDirectiveLayerMap,
      entryFiles,
    ),
    chunkFileNames() {
      const isCjsFormat = format === 'cjs'
      const ext = dts
        ? 'd.ts'
        : isCjsFormat && isEsmPkg
        ? 'cjs'
        : !isCjsFormat && !isEsmPkg
        ? 'mjs'
        : 'js'
      return '[name]-[hash].' + ext
    },
    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
    hoistTransitiveImports: false,
    entryFileNames: basename(outputFile),
  }

  return outputOptions

  // return {
  //   input: inputOptions,
  //   output: outputOptions,
  // }
}
