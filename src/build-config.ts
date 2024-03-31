import { posix } from 'path'
import type {
  Entries,
  BuncheeRollupConfig,
  BundleOptions,
  BundleConfig,
  ParsedExportCondition,
} from './types'
import type {
  GetManualChunk,
  InputOptions,
  OutputOptions,
  Plugin,
} from 'rollup'
import { convertCompilerOptions } from './typescript'

import path, { resolve, dirname, join, basename, extname } from 'path'
import { wasm } from '@rollup/plugin-wasm'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import preserveDirectives from 'rollup-preserve-directives'
import { esmShim } from './plugins/esm-shim'
import { inlineCss } from './plugins/inline-css'
import { rawContent } from './plugins/raw-plugin'
import { aliasEntries } from './plugins/alias-plugin'
import { prependDirectives } from './plugins/prepend-directives'
import { prependShebang } from './plugins/prepend-shebang'
import {
  getExportsDistFilesOfCondition,
  getExportFileTypePath,
  ExportOutput,
} from './exports'
import {
  isESModulePackage,
  isNotNull,
  filePathWithoutExtension,
  isBinExportPath,
  isTypeFile,
} from './utils'
import { memoizeByKey } from './lib/memoize'
import {
  availableESExtensionsRegex,
  nodeResolveExtensions,
  disabledWarnings,
} from './constants'
import { BuildContext } from './types'
import { getDefinedInlineVariables } from './env'
import {
  getSpecialExportTypeFromComposedExportPath,
  normalizeExportPath,
} from './entries'
import { getCustomModuleLayer, getModuleLayer } from './lib/split-chunk'

const swcMinifyOptions = {
  compress: {
    directives: false,
  },
  format: {
    comments: 'some',
  },
  mangle: {
    toplevel: true,
  },
} as const

async function createDtsPlugin(
  tsCompilerOptions: BuildContext['tsOptions']['tsCompilerOptions'],
  tsConfigPath: string | undefined,
  cwd: string,
) {
  const enableIncrementalWithoutBuildInfo =
    tsCompilerOptions.incremental && !tsCompilerOptions.tsBuildInfoFile
  const incrementalOptions = enableIncrementalWithoutBuildInfo
    ? {
        incremental: false,
      }
    : undefined
  const compositeOptions = tsCompilerOptions.composite
    ? {
        composite: false,
      }
    : undefined

  const { options: overrideResolvedTsOptions }: any =
    await convertCompilerOptions(cwd, {
      declaration: true,
      noEmit: false,
      noEmitOnError: true,
      emitDeclarationOnly: true,
      checkJs: false,
      declarationMap: false,
      skipLibCheck: true,
      // preserveSymlinks should always be set to false to avoid issues with
      // resolving types from <reference> from node_modules
      preserveSymlinks: false,
      target: 'ESNext',
      ...(!tsCompilerOptions.jsx
        ? {
            jsx: 'react-jsx',
          }
        : undefined),
      // error TS5074: Option '--incremental' can only be specified using tsconfig, emitting to single
      // file or when option '--tsBuildInfoFile' is specified.
      ...incrementalOptions,
      // error TS6379: Composite projects may not disable incremental compilation.
      ...compositeOptions,
    })

  const dtsPlugin = (
    require('rollup-plugin-dts') as typeof import('rollup-plugin-dts')
  ).default({
    tsconfig: tsConfigPath,
    compilerOptions: overrideResolvedTsOptions,
  })

  return dtsPlugin
}

// Avoid create multiple dts plugins instance and parsing the same tsconfig multi times,
// This will avoid memory leak and performance issue.
const memoizeDtsPluginByKey = memoizeByKey(createDtsPlugin)

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

async function buildInputConfig(
  entry: string,
  bundleConfig: BundleOptions,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
): Promise<InputOptions> {
  const {
    entries,
    pkg,
    cwd,
    tsOptions: { tsConfigPath, tsCompilerOptions },
    pluginContext,
  } = buildContext
  const executablePaths = Object.entries(entries)
    .filter(([key]) => isBinExportPath(key))
    .map(([_, entry]) =>
      Object.values(entry.export)
        .filter((p) => !isTypeFile(p))
        .map((p) => path.resolve(cwd, p)),
    )
    .flat()

  const hasNoExternal = bundleConfig.external === null
  const externals = hasNoExternal
    ? []
    : [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
        .filter(<T>(n?: T): n is T => Boolean(n))
        .map((o: { [key: string]: any }): string[] => Object.keys(o))
        .reduce((a: string[], b: string[]) => a.concat(b), [])
        .concat(bundleConfig.external ?? [])

  for (const [exportImportPath, exportCondition] of Object.entries(entries)) {
    const entryFilePath = exportCondition.source
    if (entryFilePath !== entry) {
      externals.push(
        posix.join(pkg.name || '', normalizeExportPath(exportImportPath)),
      )
      externals.push(entryFilePath)
    }
  }

  const inlineDefinedValues = getDefinedInlineVariables(
    bundleConfig.env || [],
    exportCondition,
  )

  const { useTypeScript } = buildContext
  const { runtime, target: jscTarget, minify: shouldMinify } = bundleConfig
  const hasSpecifiedTsTarget = Boolean(tsCompilerOptions.target && tsConfigPath)

  const swcParserConfig = {
    syntax: useTypeScript ? 'typescript' : 'ecmascript',
    [useTypeScript ? 'tsx' : 'jsx']: true,
    exportDefaultFrom: true,
  } as const

  const swcOptions: import('@swc/types').Options = {
    jsc: {
      ...(!hasSpecifiedTsTarget && {
        target: jscTarget,
      }),
      loose: true, // Use loose mode
      externalHelpers: false,
      parser: swcParserConfig,
      ...(shouldMinify && {
        minify: {
          ...swcMinifyOptions,
          sourceMap: bundleConfig.sourcemap,
        },
      }),
    },
    sourceMaps: bundleConfig.sourcemap,
    inlineSourcesContent: false,
    isModule: true,
  } as const

  const sizePlugin = pluginContext.outputState.plugin(cwd)

  // common plugins for both dts and ts assets that need to be processed

  // If it's a .d.ts file under non-ESM package or .d.cts file, use cjs types alias.
  const aliasFormat = dts
    ? bundleConfig.file?.endsWith('.d.cts') ||
      (bundleConfig.file?.endsWith('.d.ts') && !isESModulePackage(pkg.type))
      ? 'cjs'
      : 'esm'
    : bundleConfig.format

  const aliasPlugin = aliasEntries({
    entry,
    entries,
    entriesAlias: pluginContext.entriesAlias,
    format: aliasFormat,
    dts,
  })
  const commonPlugins = [json(), sizePlugin]

  const typesPlugins = [...commonPlugins, inlineCss({ skip: true })]

  if (useTypeScript) {
    // Each process should be unique
    // Each package build should be unique
    // Composing above factors into a unique cache key to retrieve the memoized dts plugin with tsconfigs
    const uniqueProcessId = 'dts-plugin:' + process.pid + tsConfigPath
    const dtsPlugin = await memoizeDtsPluginByKey(uniqueProcessId)(
      tsCompilerOptions,
      tsConfigPath,
      cwd,
    )
    typesPlugins.push(dtsPlugin)
  }

  const plugins: Plugin[] = (
    dts
      ? [...typesPlugins, aliasPlugin]
      : [
          ...commonPlugins,
          preserveDirectives(),
          aliasPlugin,
          inlineCss({ exclude: /node_modules/ }),
          rawContent({ exclude: /node_modules/ }),
          prependShebang(executablePaths),
          replace({
            values: inlineDefinedValues,
            preventAssignment: true,
          }),
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: nodeResolveExtensions,
          }),
          bundleConfig.format === 'esm' && esmShim(),
          wasm(),
          swc({
            include: availableESExtensionsRegex,
            exclude: 'node_modules',
            // Use `false` to disable retrieving tsconfig.json
            tsconfig: tsConfigPath ?? false,
            ...swcOptions,
          }),
          commonjs({
            exclude: bundleConfig.external || null,
          }),
          prependDirectives(),
        ]
  ).filter(isNotNull<Plugin>)

  return {
    input: entry,
    external(id: string) {
      return externals.some((name) => id === name || id.startsWith(name + '/'))
    },
    plugins,
    treeshake: {
      propertyReadSideEffects: false,
    },
    onwarn(warning, warn) {
      const code = warning.code || ''
      // Some may not have types, like CLI binary
      if (dts && code === 'EMPTY_BUNDLE') return
      if (disabledWarnings.has(code)) return
      // If the circular dependency warning is from node_modules, ignore it
      if (
        code === 'CIRCULAR_DEPENDENCY' &&
        /Circular dependency:(\s|\S)*node_modules/.test(warning.message)
      ) {
        return
      }
      if (code === 'MODULE_LEVEL_DIRECTIVE') {
        return
      }
      warn(warning)
    },
  }
}

// dependencyGraphMap: Map<subModuleId, Set<entryParentId>>
function createSplitChunks(
  dependencyGraphMap: Map<string, Set<[string, string]>>,
  entryFiles: Set<string>,
): GetManualChunk {
  // If there's existing chunk being splitted, and contains a layer { <id>: <chunkGroup> }
  const splitChunksGroupMap = new Map<string, string>()

  return function splitChunks(id, ctx) {
    const moduleInfo = ctx.getModuleInfo(id)
    if (!moduleInfo) {
      return
    }

    const { isEntry } = moduleInfo
    const moduleMeta = moduleInfo.meta
    const moduleLayer = getModuleLayer(moduleMeta)

    if (!isEntry) {
      const cachedCustomModuleLayer = splitChunksGroupMap.get(id)
      if (cachedCustomModuleLayer) return cachedCustomModuleLayer
      const customModuleLayer = getCustomModuleLayer(id)
      if (customModuleLayer) {
        splitChunksGroupMap.set(id, customModuleLayer)
        return customModuleLayer
      }
    }

    // Collect the sub modules of the entry, if they're having layer, and the same layer with the entry, push them to the dependencyGraphMap.
    if (isEntry) {
      const subModuleIds = ctx.getModuleIds()
      for (const subId of subModuleIds) {
        const subModuleInfo = ctx.getModuleInfo(subId)
        if (!subModuleInfo) {
          continue
        }

        const subModuleLayer = getModuleLayer(moduleMeta)
        if (subModuleLayer === moduleLayer) {
          if (!dependencyGraphMap.has(subId)) {
            dependencyGraphMap.set(subId, new Set())
          }
          dependencyGraphMap.get(subId)!.add([id, moduleLayer])
        }
      }
    }

    if (!isEntry) {
    }

    // If current module has a layer, and it's not an entry
    if (moduleLayer && !isEntry) {
      // If the module is imported by the entry:
      // when the module layer is same as entry layer, keep it as part of entry and don't split it;
      // when the module layer is different from entry layer, split the module into a separate chunk as a separate boundary.
      if (dependencyGraphMap.has(id)) {
        const parentModuleIds = Array.from(dependencyGraphMap.get(id)!)
        const isImportFromOtherEntry = parentModuleIds.some(([id]) => {
          // If other entry is dependency of this entry
          if (entryFiles.has(id)) {
            const entryModuleInfo = ctx.getModuleInfo(id)
            const entryModuleLayer = getModuleLayer(
              entryModuleInfo ? entryModuleInfo.meta : {},
            )
            return entryModuleLayer === moduleLayer
          }
          return false
        })
        if (isImportFromOtherEntry) return

        const isPartOfCurrentEntry = parentModuleIds.every(
          ([, layer]) => layer === moduleLayer,
        )
        if (isPartOfCurrentEntry) {
          if (splitChunksGroupMap.has(id)) {
            return splitChunksGroupMap.get(id)
          }
          return
        }

        const chunkName = path.basename(id, path.extname(id))
        const chunkGroup = `${chunkName}-${moduleLayer}`

        splitChunksGroupMap.set(id, chunkGroup)
        return chunkGroup
      }
    }
    return
  }
}

async function buildOutputConfigs(
  entry: string,
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
): Promise<{
  input: InputOptions
  output: OutputOptions
}> {
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
  const outputFileExtension = extname(absoluteOutputFile)
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

  const inputOptions = await buildInputConfig(
    entry,
    bundleConfig,
    exportCondition,
    buildContext,
    dts,
  )

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
      const ext =
        format === 'cjs' && outputFileExtension === '.cjs' ? 'cjs' : 'js'
      return '[name]-[hash].' + ext
    },
    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
    hoistTransitiveImports: false,
    entryFileNames: basename(outputFile),
  }

  return {
    input: inputOptions,
    output: outputOptions,
  }
}

export async function buildEntryConfig(
  bundleConfig: BundleConfig,
  pluginContext: BuildContext,
  dts: boolean,
): Promise<BuncheeRollupConfig[]> {
  const configs: BuncheeRollupConfig[] = []
  const { entries } = pluginContext
  for (const exportCondition of Object.values(entries)) {
    const rollupConfigs = await buildConfig(
      bundleConfig,
      exportCondition,
      pluginContext,
      dts,
    )
    configs.push(...rollupConfigs)
  }
  return configs
}

async function buildConfig(
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  pluginContext: BuildContext,
  dts: boolean,
): Promise<BuncheeRollupConfig[]> {
  const { file } = bundleConfig
  const { pkg, cwd } = pluginContext
  const entry = exportCondition.source

  const outputExports = getExportsDistFilesOfCondition(
    pkg,
    exportCondition,
    cwd,
    dts,
  )

  // If there's nothing found, give a default output
  if (outputExports.length === 0 && !pkg.bin) {
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
    return await buildOutputConfigs(
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
