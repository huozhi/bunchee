import type {
  Entries,
  PackageMetadata,
  BuncheeRollupConfig,
  BundleOptions,
  BundleConfig,
  ParsedExportCondition,
  ExportPaths,
  FullExportCondition,
} from './types'
import type { CustomPluginOptions, GetManualChunk, InputOptions, OutputOptions, Plugin } from 'rollup'
import { type TypescriptOptions } from './typescript'

import path, { resolve, dirname, extname, join, basename } from 'path'
import { wasm } from '@rollup/plugin-wasm'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import esmShim from '@rollup/plugin-esm-shim'
import preserveDirectives from 'rollup-preserve-directives'
import { inlineCss } from './plugins/inline-css'
import { rawContent } from './plugins/raw-plugin'
import { aliasEntries } from './plugins/alias-plugin'
import { prependDirectives } from './plugins/prepend-directives'
import {
  getTypings,
  getExportPaths,
  getExportConditionDist,
  isEsmExportName,
  getExportTypeDist,
  isESModulePackage,
} from './exports'
import {
  isNotNull,
  getSourcePathFromExportPath,
  resolveSourceFile,
  filenameWithoutExtension,
} from './utils'
import {
  availableExportConventions,
  availableESExtensionsRegex,
  dtsExtensions,
  nodeResolveExtensions,
} from './constants'
import { logger } from './logger'
import { PluginContext } from './plugins/size-plugin'

const swcMinifyOptions = {
  compress: true,
  format: {
    comments: 'some',
  },
  mangle: {
    toplevel: true,
  },
} as const

function getBuildEnv(envs: string[]) {
  if (!envs.includes('NODE_ENV')) {
    envs.push('NODE_ENV')
  }
  const envVars = envs.reduce((acc: Record<string, string>, key) => {
    const value = process.env[key]
    if (typeof value !== 'undefined') {
      acc['process.env.' + key] = JSON.stringify(value)
    }
    return acc
  }, {})

  return envVars
}

/**
 * return { '<pkg>/<export>': '<absolute source path> }
 */
function getEntriesAlias(entries: Entries) {
  const alias: Record<string, string> = {}
  for (const [entryImportPath, exportCondition] of Object.entries(entries)) {
    alias[entryImportPath] = exportCondition.source
  }
  return alias
}

async function buildInputConfig(
  entry: string,
  entries: Entries,
  pkg: PackageMetadata,
  options: BundleOptions,
  cwd: string,
  { tsConfigPath, tsCompilerOptions }: TypescriptOptions,
  pluginContext: PluginContext,
  dts: boolean,
): Promise<InputOptions> {
  const entriesAlias = getEntriesAlias(entries)
  const reversedAlias: Record<string, string> = {}
  for (const [key, value] of Object.entries(entriesAlias)) {
    if (value !== entry) {
      reversedAlias[value] = key
    }
  }
  const hasNoExternal = options.external === null
  const externals = hasNoExternal
    ? []
    : [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
        .filter(<T>(n?: T): n is T => Boolean(n))
        .map((o: { [key: string]: any }): string[] => Object.keys(o))
        .reduce((a: string[], b: string[]) => a.concat(b), [])
        .concat((options.external ?? []))

  for (const [exportImportPath, entryFilePath] of Object.entries(entriesAlias)) {
    if (entryFilePath !== entry) {
      externals.push(exportImportPath)
      externals.push(entryFilePath)
    }
  }

  const {
    useTypescript,
    runtime,
    target: jscTarget,
    minify: shouldMinify,
  } = options
  const hasSpecifiedTsTarget = Boolean(
    tsCompilerOptions.target && tsConfigPath,
  )

  const swcParserConfig = {
    syntax: useTypescript ? 'typescript' : 'ecmascript',
    [useTypescript ? 'tsx' : 'jsx']: true,
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
          sourceMap: options.sourcemap,
        },
      }),
    },
    sourceMaps: options.sourcemap,
    inlineSourcesContent: false,
    isModule: true,
  } as const

  const sizePlugin = pluginContext.sizeCollector.plugin(cwd)

  // common plugins for both dts and ts assets that need to be processed
  const commonPlugins = [
    sizePlugin,
    aliasEntries({
      entries: reversedAlias,
    })
  ]

  const baseResolvedTsOptions: any = {
    declaration: true,
    noEmit: false,
    noEmitOnError: true,
    emitDeclarationOnly: true,
    checkJs: false,
    declarationMap: false,
    skipLibCheck: true,
    preserveSymlinks: false,
    // disable incremental build
    incremental: false,
    // use default tsBuildInfoFile value
    tsBuildInfoFile: '.tsbuildinfo',
    target: 'esnext',
    module: 'esnext',
    jsx: tsCompilerOptions.jsx || 'react',
  }

  const typesPlugins = [
    ...commonPlugins,
    inlineCss({ skip: true }),
  ]

  if (useTypescript) {
    const mergedOptions = {
      ...baseResolvedTsOptions,
      ...tsCompilerOptions,
    }

    // error TS5074: Option '--incremental' can only be specified using tsconfig, emitting to single
    // file or when option '--tsBuildInfoFile' is specified.
    if (!mergedOptions.incremental) {
      delete mergedOptions.incremental
      delete mergedOptions.tsBuildInfoFile
    }

    const dtsPlugin = (require('rollup-plugin-dts') as typeof import('rollup-plugin-dts')).default({
      tsconfig: undefined,
      compilerOptions: mergedOptions,
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
            values: getBuildEnv(options.env || []),
            preventAssignment: true,
          }),
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: nodeResolveExtensions,
          }),
          commonjs({
            exclude: options.external || null,
          }),
          json(),
          wasm(),
          swc({
            include: availableESExtensionsRegex,
            exclude: 'node_modules',
            tsconfig: tsConfigPath,
            ...swcOptions,
          }),
          esmShim()
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
      if (
        [
          'MIXED_EXPORTS',
          'PREFER_NAMED_EXPORTS',
          'UNRESOLVED_IMPORT',
          'THIS_IS_UNDEFINED',
        ].includes(code)
      )
        return
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

function hasEsmExport(
  exportPaths: ReturnType<typeof getExportPaths>,
  tsCompilerOptions: TypescriptOptions['tsCompilerOptions'],
) {
  let hasEsm = false
  for (const key in exportPaths) {
    const exportInfo = exportPaths[key]
    const exportInfoEntries = Object.entries(exportInfo)

    if (
      exportInfoEntries.some(([exportType, file]) =>
        isEsmExportName(exportType, file),
      )
    ) {
      hasEsm = true
      break
    }
  }
  return Boolean(hasEsm || tsCompilerOptions?.esModuleInterop)
}

function getModuleLater(moduleMeta: CustomPluginOptions) {
  const directives = (moduleMeta.preserveDirectives || { directives: [] }).directives
    .map((d: string) => d.replace(/^use /, ''))
    .filter((d: string) => d !== 'strict')

  const moduleLayer = directives[0]
  return moduleLayer
}

// dependencyGraphMap: Map<subModuleId, Set<entryParentId>>
function createSplitChunks(dependencyGraphMap: Map<string, Set<string>>): GetManualChunk {
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
          dependencyGraphMap.get(subId)!.add(id)
        }
      }
    }

    // If current module has a layer, and it's not an entry
    if (moduleLayer && !isEntry) {
      // If the module is imported by the entry:
      // when the module layer is same as entry layer, keep it as part of entry and don't split it;
      // when the module layer is different from entry layer, split the module into a separate chunk as a separate boundary.
      if (dependencyGraphMap.has(id)) {
        const parentModuleLayers = Array.from(dependencyGraphMap.get(id)!)
        if (parentModuleLayers.every(layer => layer === moduleLayer)) {
          return
        }
        const chunkName = path.basename(id, path.extname(id))
        return `${chunkName}-${moduleLayer}`
      }
    }
    return
  }
}

function buildOutputConfigs(
  pkg: PackageMetadata,
  exportPaths: ExportPaths,
  options: BundleOptions,
  exportCondition: ParsedExportCondition,
  cwd: string,
  { tsCompilerOptions }: TypescriptOptions,
  pluginContext: PluginContext,
  dts: boolean,
): OutputOptions {
  const { format } = options
  // Add esm mark and interop helper if esm export is detected
  const useEsModuleMark = hasEsmExport(exportPaths, tsCompilerOptions)
  const typings: string | undefined = getTypings(pkg)
  const file = options.file && resolve(cwd, options.file)

  const dtsDir = typings ? dirname(resolve(cwd, typings)) : resolve(cwd, 'dist')
  const name = filenameWithoutExtension(file)

  // TODO: simplify dts file name detection
  const dtsFile = file
    ? file
    : exportCondition.export['types']
    ? resolve(cwd, exportCondition.export['types'])
    : resolve(
        dtsDir,
        (exportCondition.name === '.' ? 'index' : exportCondition.name) +
          '.d.ts',
      )

  const dtsPathConfig = { dir: dtsFile ? dirname(dtsFile) : dtsDir }
  const outputFile: string = (dtsFile || file)!

  return {
    name: pkg.name || name,
    ...(dts ? dtsPathConfig : { dir: dirname(outputFile) }),
    format,
    exports: 'named',
    esModule: useEsModuleMark || 'if-default-prop',
    interop: 'auto',
    freeze: false,
    strict: false,
    sourcemap: options.sourcemap,
    manualChunks: createSplitChunks(pluginContext.moduleDirectiveLayerMap),
    chunkFileNames: '[name]-[hash].js',
    // By default in rollup, when creating multiple chunks, transitive imports of entry chunks
    // will be added as empty imports to the entry chunks. Disable to avoid imports hoist outside of boundaries
    hoistTransitiveImports: false,
    entryFileNames: basename(outputFile),
  }
}

export async function buildEntryConfig(
  entries: Entries,
  pkg: PackageMetadata,
  exportPaths: ExportPaths,
  bundleConfig: BundleConfig,
  cwd: string,
  tsOptions: TypescriptOptions,
  pluginContext: PluginContext,
  dts: boolean,
): Promise<BuncheeRollupConfig[]> {
  const configs: Promise<BuncheeRollupConfig>[] = []

  for (const exportCondition of Object.values(entries)) {
    const rollupConfig = buildConfig(
      entries,
      pkg,
      exportPaths,
      bundleConfig,
      exportCondition,
      cwd,
      tsOptions,
      pluginContext,
      dts,
    )
    configs.push(rollupConfig)
  }
  return (await Promise.all(configs))
}

/*
 * build configs for each entry from package exports
 *
 * return { <pkg>/<export>: { input: InputOptions, output: OutputOptions[] }
 */
export async function collectEntries(
  pkg: PackageMetadata,
  entryPath: string,
  exportPaths: ExportPaths,
  cwd: string,
): Promise<Entries> {
  const entries: Entries = {}

  async function collectEntry(
    // export type, e.g. react-server, edge-light those special cases required suffix
    exportType: string,
    exportCondRef: FullExportCondition,
    // export name, e.g. ./<export-path> in exports field of package.json
    entryExport: string,
  ) {
    let exportCondForType: FullExportCondition = { ...exportCondRef }
    // Special cases of export type, only pass down the exportPaths for the type
    if (availableExportConventions.includes(exportType)) {
      exportCondForType = {
        [entryExport]: exportCondRef[exportType],
      }
      // Basic export type, pass down the exportPaths with erasing the special ones
    } else {
      for (const exportType of availableExportConventions) {
        delete exportCondForType[exportType]
      }
    }

    let source: string | undefined = entryPath
    if (source) {
      source = resolveSourceFile(cwd!, source)
    } else {
      source = await getSourcePathFromExportPath(cwd, entryExport, exportType)
    }
    if (!source) {
      return undefined
    }

    const exportCondition: ParsedExportCondition = {
      source,
      name: entryExport,
      export: exportCondForType,
    }

    const entryImportPath = path.join(pkg.name || '', exportCondition.name) + (exportType ? `.${exportType}` : '')
    entries[entryImportPath] = exportCondition
  }

  const binaryExports = pkg.bin

  if (binaryExports) {
    // binDistPaths: [ [ 'bin1', './dist/bin1.js'], [ 'bin2', './dist/bin2.js'] ]
    const binPairs = typeof binaryExports === 'string'
      ? [['bin', binaryExports]]
      : Object.keys(binaryExports)
        .map((key) => [join('bin', key), (binaryExports)[key]])

    const isESModule = isESModulePackage(pkg.type)
    const binExportPaths = binPairs.reduce((acc, [binName, binDistPath]) => {
      const ext = extname(binDistPath).slice(1) as keyof typeof dtsExtensions
      const isCjsExt = ext === 'cjs'
      const isEsmExt = ext === 'mjs'

      const exportType = isEsmExt
        ? 'import'
        : isCjsExt
        ? 'require'
        : isESModule
        ? 'import'
        : 'require'

      acc[binName] = {
        [exportType]: binDistPath,
      }
      return acc
    }, {} as ExportPaths)

    for (const [binName] of binPairs) {
      const source = await getSourcePathFromExportPath(
        cwd,
        binName,
        '$binary'
      )

      if (!source) {
        logger.warn(`Cannot find source file for ${binName}`)
        continue
      }

      const binEntryPath = await resolveSourceFile(cwd, source)
      entries[binName] = {
        source: binEntryPath,
        name: binName,
        export: binExportPaths[binName],
      }
    }
  }

  const collectEntriesPromises = Object.keys(exportPaths).map(async (entryExport) => {
    const exportCond = exportPaths[entryExport]
    await collectEntry('', exportCond, entryExport)

    for (const exportType of availableExportConventions) {
      if (exportCond[exportType]) {
        await collectEntry(exportType, exportCond, entryExport)
      }
    }
  })

  await Promise.all(collectEntriesPromises)
  return entries
}

async function buildConfig(
  entries: Entries,
  pkg: PackageMetadata,
  exportPaths: ExportPaths,
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  cwd: string,
  tsOptions: TypescriptOptions,
  pluginContext: PluginContext,
  dts: boolean,
): Promise<BuncheeRollupConfig> {
  const { file } = bundleConfig
  const useTypescript = Boolean(tsOptions.tsConfigPath)
  const options = { ...bundleConfig, useTypescript }
  const entry = exportCondition.source
  const inputOptions = await buildInputConfig(
    entry,
    entries,
    pkg,
    options,
    cwd,
    tsOptions,
    pluginContext,
    dts,
  )
  const outputExports = getExportConditionDist(pkg, exportCondition, cwd)

  let outputConfigs = []

  // Generate dts job - single config
  if (dts) {
    const typeOutputExports = getExportTypeDist(exportCondition, cwd)
    outputConfigs = typeOutputExports.map((typeFile) =>
      buildOutputConfigs(
        pkg,
        exportPaths,
        {
          ...bundleConfig,
          format: 'es',
          useTypescript,
          file: typeFile,
        },
        exportCondition,
        cwd,
        tsOptions,
        pluginContext,
        dts,
      ),
    )
  } else {
    // multi outputs with specified format
    outputConfigs = outputExports.map((exportDist) => {
      return buildOutputConfigs(
        pkg,
        exportPaths,
        {
          ...bundleConfig,
          file: exportDist.file,
          format: exportDist.format,
          useTypescript,
        },
        exportCondition,
        cwd,
        tsOptions,
        pluginContext,
        dts,
      )
    })
    // CLI output option is always prioritized
    if (file) {
      const fallbackFormat = outputExports[0]?.format
      outputConfigs = [
        buildOutputConfigs(
          pkg,
          exportPaths,
          {
            ...bundleConfig,
            file,
            format: bundleConfig.format || fallbackFormat,
            useTypescript,
          },
          exportCondition,
          cwd,
          tsOptions,
          pluginContext,
          dts,
        ),
      ]
    }
  }

  return {
    input: inputOptions,
    output: outputConfigs,
    exportName: exportCondition.name || '.',
  }
}
