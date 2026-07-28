import type { OutputOptions } from 'rollup'
import type {
  BuildContext,
  BundleConfig,
  ParsedExportCondition,
} from '../types'
import { createSplitChunks } from './split-chunks'
import { resolve, dirname, basename } from 'path'
import { filePathWithoutExtension, isESModulePackage } from '../utils'

export async function buildOutputConfigs(
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
  merged: boolean = false,
): Promise<OutputOptions> {
  const { format } = bundleConfig
  const {
    entries,
    pkg,
    cwd,
    tsOptions: { tsCompilerOptions },
    pluginContext,
  } = buildContext
  // Add esm mark and interop helper if esm export is detected
  const useEsModuleMark = tsCompilerOptions?.esModuleInterop
  const absoluteOutputFile = resolve(cwd, bundleConfig.file!)
  const isEsmPkg = isESModulePackage(pkg.type)
  const name = filePathWithoutExtension(absoluteOutputFile)
  // For a types job `bundleConfig.file` is already the declaration path.
  const outputFile: string = absoluteOutputFile
  const entryFiles = new Set(
    Object.values(entries).map((entry) => entry.source),
  )

  // By default, respect the original bunchee sourcemap option
  let sourcemap: boolean = !!bundleConfig.sourcemap

  // If it's typescript, checking if declaration map is enabled,
  // otherwise we don't enable sourcemap for type files.
  // cases:
  // sourcemap (✓) + declarationMap (✓) => sourcemap for dts
  // sourcemap (✗) + declarationMap (✓) => sourcemap for dts
  // sourcemap (✓) + declarationMap (✗) => no sourcemap for dts
  // sourcemap (✗) + declarationMap (✗) => no sourcemap for dts
  if (dts) {
    sourcemap = !!tsCompilerOptions?.declarationMap
  }

  /** Group name -> emitted base name, populated by `createSplitChunks`. */
  const chunkBaseNames = new Map<string, string>()

  const outputOptions: OutputOptions = {
    name: pkg.name || name,
    extend: true,
    dir: dirname(outputFile),
    format,
    exports: 'named',
    esModule: useEsModuleMark || 'if-default-prop',
    interop: 'auto',
    freeze: false,
    strict: false,
    sourcemap,
    // Rollup's default hash alphabet is base64url, which includes `-` — so the
    // hash itself could add dashes to a name that already has one before it,
    // sometimes two in a row (`mod_asset-12s--5vqDwxI.js`). base36 is
    // alphanumeric, which leaves that single dash as the only one in the name.
    hashCharacters: 'base36',
    manualChunks: createSplitChunks(
      pluginContext.moduleDirectiveLayerMap,
      entryFiles,
      merged,
      chunkBaseNames,
    ),
    chunkFileNames(chunk) {
      const isCjsFormat = format === 'cjs'
      const ext = dts
        ? 'd.ts'
        : isCjsFormat && isEsmPkg
          ? 'cjs'
          : !isCjsFormat && !isEsmPkg
            ? 'mjs'
            : 'js'
      // A boundary group is keyed by layer so the layers cannot merge, but the
      // file is written under the module's own name — the layer is only part of
      // the key. Chunks rollup names itself are not in the map and keep
      // `[name]`.
      const base = chunkBaseNames.get(chunk.name)
      return `${base ?? '[name]'}-[hash].${ext}`
    },
    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
    hoistTransitiveImports: false,
    entryFileNames: basename(outputFile),
  }

  return outputOptions
}
