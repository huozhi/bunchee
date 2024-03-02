import type {
  Entries,
  PackageMetadata,
  BuncheeRollupConfig,
  BundleOptions,
  BundleConfig,
  ParsedExportCondition,
  // ExportPaths,
  FullExportCondition,
} from './types'
import type {
  CustomPluginOptions,
  GetManualChunk,
  InputOptions,
  OutputOptions,
  Plugin,
} from 'rollup'
import {
  convertCompilerOptions,
  // type TypescriptOptions
} from './typescript'

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
import {
  // getExportPaths,
  getExportsDistFilesOfCondition,
  // isEsmExportName,
  // getExportTypeFromFile,
  getExportFileTypePath,
  isESModulePackage,
  ExportOutput,
} from './exports'
import {
  isNotNull,
  getSourcePathFromExportPath,
  resolveSourceFile,
  filePathWithoutExtension,
} from './utils'
import {
  runtimeExportConventions,
  availableESExtensionsRegex,
  nodeResolveExtensions,
  disabledWarnings,
  optimizeConventions,
} from './constants'
// import { logger } from './logger'
import { BuildContext } from './types'
import { getDefinedInlineVariables } from './env'
// import { collectBinaries } from './entries'

const swcMinifyOptions = {
  compress: true,
  format: {
    comments: 'some',
  },
  mangle: {
    toplevel: true,
  },
} as const

/**
 * return {
 *   <absolute source path>: <pkg>/<export>
 * }
 */
export function getReversedAlias(entries: Entries) {
  const alias: Record<string, string> = {}
  for (const [entryImportPath, exportCondition] of Object.entries(entries)) {
    const exportType = entryImportPath.split('.')[1] // e.g. index.react-server, pick react-server
    if (!exportType) {
      alias[exportCondition.source] = entryImportPath
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
      externals.push(exportImportPath)
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

  const commonPlugins = [
    json(),
    sizePlugin,
    aliasEntries({
      entry,
      entries,
      entriesAlias: pluginContext.entriesAlias,
      format: aliasFormat,
      dts,
    }),
  ]

  const typesPlugins = [...commonPlugins, inlineCss({ skip: true })]

  if (useTypeScript) {
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

    typesPlugins.push(dtsPlugin)
  }

  const plugins: Plugin[] = (
    dts
      ? typesPlugins
      : [
          ...commonPlugins,
          inlineCss({ exclude: /node_modules/ }),
          rawContent({ exclude: /node_modules/ }),
          preserveDirectives(),
          prependDirectives(),
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
        /Circular dependency: node_modules/.test(warning.message)
      ) {
        return
      }
      warn(warning)
    },
  }
}

// function hasEsmExport(
//   exportPaths: ReturnType<typeof getExportPaths>,
//   tsCompilerOptions: TypescriptOptions['tsCompilerOptions'],
// ) {
//   let hasEsm = false
//   for (const key in exportPaths) {
//     const exportInfo = exportPaths[key]
//     const exportInfoEntries = Object.entries(exportInfo)

//     if (
//       exportInfoEntries.some(([exportType, file]) =>
//         isEsmExportName(exportType, file),
//       )
//     ) {
//       hasEsm = true
//       break
//     }
//   }
//   return Boolean(hasEsm || tsCompilerOptions?.esModuleInterop)
// }

function getModuleLater(moduleMeta: CustomPluginOptions) {
  const directives = (
    moduleMeta.preserveDirectives || { directives: [] }
  ).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  const moduleLayer = directives[0]
  return moduleLayer
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
    const moduleLayer = getModuleLater(moduleMeta)

    // Collect the sub modules of the entry, if they're having layer, and the same layer with the entry, push them to the dependencyGraphMap.
    if (isEntry) {
      const subModuleIds = ctx.getModuleIds()
      for (const subId of subModuleIds) {
        const subModuleInfo = ctx.getModuleInfo(subId)
        if (!subModuleInfo) {
          continue
        }

        const subModuleLayer = getModuleLater(moduleMeta)
        if (subModuleLayer === moduleLayer) {
          if (!dependencyGraphMap.has(subId)) {
            dependencyGraphMap.set(subId, new Set())
          }
          dependencyGraphMap.get(subId)!.add([id, moduleLayer])
        }
      }
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
            const entryModuleLayer = getModuleLater(
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

export async function collectEntry(
  // export type, e.g. react-server, edge-light those special cases required suffix
  exportType: string,
  options: {
    cwd: string
    pkg: PackageMetadata
    entries: Entries
    entryPath: string
    exportCondRef: FullExportCondition
    // export name, e.g. ./<export-path> in exports field of package.json
    entryExport: string
  },
): Promise<void> {
  const {
    cwd,
    pkg,
    entries,
    entryPath,
    exportCondRef,
    entryExport: originEntryExport,
  } = options
  let entryExport = originEntryExport
  let exportCondForType: FullExportCondition = { ...exportCondRef }
  // Special cases of export type, only pass down the exportPaths for the type
  const exportTypes = Object.keys(exportCondForType)
  if (runtimeExportConventions.has(exportType)) {
    exportCondForType = {
      [exportType]: exportCondRef[exportType],
    }
  } else {
    let hasOptimizeType = false
    for (const exportType of exportTypes) {
      const [, optimizedType] = exportType.split('.')
      if (optimizeConventions.has(optimizedType)) {
        hasOptimizeType = true
        // delete exportCondForType[exportType]
        exportCondForType = {
          [exportType]: exportCondRef[exportType],
        }
      }
    }

    if (!hasOptimizeType) {
      // Basic export type, pass down the exportPaths with erasing the special ones
      for (const exportType of runtimeExportConventions) {
        delete exportCondForType[exportType]
      }
      exportCondForType = {
        [exportType]: exportCondRef[exportType],
      }
    }
  }

  const parsedName = originEntryExport
  const parsedExportType = exportCondForType

  const nameWithExportPath = pkg.name
    ? path.join(pkg.name, parsedName)
    : parsedName
  const needsDelimiter = !nameWithExportPath.endsWith('.') && exportType
  const entryImportPath =
    nameWithExportPath + (needsDelimiter ? '.' : '') + exportType

  if (entryImportPath in entries) {
    return
  }

  let source: string | undefined = entryPath
  if (source) {
    source = resolveSourceFile(cwd!, source)
  } else {
    source = await getSourcePathFromExportPath(cwd, entryExport, exportType)
  }
  if (!source) {
    return
  }

  const exportCondition: ParsedExportCondition = {
    source,
    name: parsedName,
    export: parsedExportType,
  }

  entries[entryImportPath] = exportCondition
}

/*
 * build configs for each entry from package exports
 *
 * return { <pkg>/<export>: { input: InputOptions, output: OutputOptions[] }
 */

/*
export async function collectEntries(
  pkg: PackageMetadata,
  entryPath: string,
  exportPaths: ExportPaths,
  cwd: string,
): Promise<Entries> {
  const entries: Entries = {}

  await collectBinaries(entries, pkg, cwd)

  const collectEntriesPromises = Object.keys(exportPaths).map(
    async (entryExport) => {
      const exportCond = exportPaths[entryExport]
      const collectEntryOptions = {
        cwd,
        pkg,
        entries,
        entryPath,
        exportCondRef: exportCond,
        entryExport,
      }
      if (entryExport.startsWith('.')) {
        await collectEntry('', collectEntryOptions)
        for (const exportCondType of suffixedExportConventions) {
          if (exportCond[exportCondType]) {
            await collectEntry(exportCondType, collectEntryOptions)
          }
        }
        for (const key of Object.keys(exportCond)) {
          if (optimizeConventions.has(key.split('.')[1])) {
            await collectEntry(key, collectEntryOptions)
          }
        }
      }
    },
  )

  await Promise.all(collectEntriesPromises)
  return entries
}
*/

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

  // multi outputs with specified format

  // CLI output option is always prioritized
  if (file) {
    const fallbackExport = outputExports[0]
    bundleOptions = [
      {
        file: resolve(cwd, file),
        format: bundleConfig.format || fallbackExport.format,
        exportCondition: fallbackExport.exportCondition,
      },
    ]
  } else {
    bundleOptions = outputExports.map((exportDist) => {
      return {
        file: resolve(cwd, exportDist.file),
        format: exportDist.format,
        exportCondition: exportDist.exportCondition,
      }
    })
  }
  if (dts) {
    // types could have duplicates, dedupe them
    // e.g. { types, import, .. } use the same `types` condition with all conditions
    const uniqTypes = new Set<string>()
    bundleOptions.forEach((bundleOption) => {
      if (exportCondition.export.types) {
        uniqTypes.add(resolve(cwd, exportCondition.export.types))
      }
      const typeForExtension = getExportFileTypePath(bundleOption.file)
      uniqTypes.add(typeForExtension)
    })

    bundleOptions = Array.from(uniqTypes).map((typeFile) => {
      return {
        file: typeFile,
        format: 'esm',
        exportCondition: 'types',
      }
    })
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
