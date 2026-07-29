import { Plugin } from 'rollup'
import { type Options as SwcOptions } from '@swc/core'
import {
  BuildContext,
  BundleOptions,
  CustomRollupInputOptions,
  ParsedExportCondition,
} from '../types'
import { isBinExportPath, isESModulePackage, isNotNull } from '../utils'
import { normalizeExportPath } from '../entries'
import { getDefinedInlineVariables } from '../env'
import { dirname, posix } from 'path'
import { createRequire } from 'module'
import { wasm } from '@rollup/plugin-wasm'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import preserveDirectives from 'rollup-preserve-directives'
import { esmShim } from '../plugins/esm-shim'
import { inlineCss } from '../plugins/inline-css'
import { rawContent } from '../plugins/raw-plugin'
import { nativeAddon } from '../plugins/native-addon-plugin'
import { aliasEntries, getAliasFormat } from '../plugins/alias-plugin'
import { prependShebang } from '../plugins/prepend-shebang'
import { swcHelpersWarningPlugin } from '../plugins/swc-helpers-warning-plugin'
import { memoizeByKey } from '../lib/memoize'
import {
  convertCompilerOptions,
  isTsConfigAutoDiscoverable,
} from '../typescript'
import {
  availableESExtensionsRegex,
  disabledWarnings,
  nodeResolveExtensions,
} from '../constants'

// `rollup-plugin-dts` is loaded through CJS on purpose: its `require`
// of `typescript` is what the TypeScript 7 compat redirect in `../typescript`
// patches, and that patch only reaches CommonJS resolution.
const require = createRequire(import.meta.url)

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
  respectExternal: boolean | undefined,
  cwd: string,
  /**
   * Set when the plugin would find this tsconfig on its own, in which case not
   * naming it is both equivalent and much faster — see
   * `isTsConfigAutoDiscoverable`.
   */
  autoDiscoverable: boolean,
) {
  const enableIncrementalWithoutBuildInfo =
    tsCompilerOptions?.incremental && !tsCompilerOptions?.tsBuildInfoFile
  const incrementalOptions = enableIncrementalWithoutBuildInfo
    ? {
        incremental: false,
      }
    : undefined
  const compositeOptions = tsCompilerOptions?.composite
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
      skipLibCheck: true,
      // preserveSymlinks should always be set to false to avoid issues with
      // resolving types from <reference> from node_modules
      preserveSymlinks: false,
      target: 'ESNext',
      ...(!tsCompilerOptions?.jsx
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
    tsconfig: autoDiscoverable ? undefined : tsConfigPath,
    compilerOptions: overrideResolvedTsOptions,
    respectExternal,
  })

  return dtsPlugin
}

const memoizeDtsPluginByKey = memoizeByKey(createDtsPlugin)

export async function buildInputConfig(
  entry: string,
  bundleConfig: BundleOptions,
  exportCondition: ParsedExportCondition,
  buildContext: BuildContext,
  dts: boolean,
  /**
   * When set, every entry in the map is an input of one shared rollup build
   * instead of `entry` being the only one. Sibling entries then live in the
   * same module graph, so they must not be externalized and rollup emits the
   * cross-entry imports itself — which is what the alias plugin does by hand
   * on the per-entry path.
   */
  mergedInputs?: Record<string, string>,
): Promise<CustomRollupInputOptions> {
  const {
    entries,
    pkg,
    cwd,
    tsOptions: { tsConfigPath, tsCompilerOptions },
    browserslistConfig,
    pluginContext,
  } = buildContext
  const isBinEntry = isBinExportPath(exportCondition.name)
  // A merged build can hold bin and non-bin entries at once, so the shebang is
  // driven by which of its inputs are bin sources rather than by one entry.
  const binSources = new Set(
    Object.entries(entries)
      .filter(([exportPath]) => isBinExportPath(exportPath))
      .map(([, condition]) => condition.source),
  )
  const isMerged = mergedInputs != null
  const mergedSources = new Set(Object.values(mergedInputs ?? {}))

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
      // Self-referencing subpath imports (`<pkg>/<subpath>`) stay external in
      // both modes — rollup cannot resolve them and Node picks the condition.
      externals.push(
        posix.join(pkg.name || '', normalizeExportPath(exportImportPath)),
      )
      // The source path is only external when the sibling is built separately.
      // In a merged build it is an input of this same graph.
      if (!mergedSources.has(entryFilePath)) {
        externals.push(entryFilePath)
      }
    }
  }

  const inlineDefinedValues = getDefinedInlineVariables(
    bundleConfig.env || [],
    exportCondition,
  )

  const { useTypeScript } = buildContext
  const { runtime, target: jscTarget, minify: shouldMinify } = bundleConfig
  const hasSpecifiedTsTarget = Boolean(
    tsCompilerOptions?.target && tsConfigPath,
  )

  const swcParserConfig: import('@swc/types').ParserConfig = {
    syntax: useTypeScript ? 'typescript' : 'ecmascript',
    [useTypeScript ? 'tsx' : 'jsx']: true,
    exportDefaultFrom: true,
    decorators: true,
  } as const

  const hasBrowserslistConfig = !!(browserslistConfig && !hasSpecifiedTsTarget)
  const sourceMap = bundleConfig.sourcemap
  const swcOptions = {
    jsc: {
      ...(!hasSpecifiedTsTarget &&
        !hasBrowserslistConfig && {
          target: jscTarget,
        }),
      loose: true, // Use loose mode
      externalHelpers: true,
      parser: swcParserConfig,
      transform: {
        decoratorVersion: '2022-03',
      },
      ...(shouldMinify && {
        minify: {
          ...swcMinifyOptions,
          sourceMap: sourceMap,
        },
      }),
    },
    sourceMaps: sourceMap,
    inlineSourcesContent: false,
    isModule: true,
    ...(hasBrowserslistConfig && {
      env: {
        targets: browserslistConfig,
      },
    }),
  } satisfies SwcOptions

  const sizePlugin = pluginContext.outputState.plugin(cwd)

  // common plugins for both dts and ts assets that need to be processed

  const aliasFormat = getAliasFormat({
    dts,
    file: bundleConfig.file,
    format: bundleConfig.format,
    isESMPkg: isESModulePackage(pkg.type),
  })

  const aliasPlugin = aliasEntries({
    entry,
    entries,
    format: aliasFormat,
    isESMPkg: isESModulePackage(pkg.type),
    exportCondition,
    dts,
    cwd,
    // In a merged build the plugin only rewrites references to entries this
    // build does not own; rollup emits the rest as chunk imports.
    mergedSources: isMerged ? mergedSources : undefined,
  })
  const commonPlugins = [json(), sizePlugin]

  const typesPlugins: (Plugin | false)[] = [
    aliasPlugin,
    ...commonPlugins,
    inlineCss({ skip: true }),
  ]

  if (useTypeScript) {
    // Each process should be unique
    // Each package build should be unique
    // Composing above factors into a unique cache key to retrieve the memoized dts plugin with tsconfigs
    const autoDiscoverable = isTsConfigAutoDiscoverable(cwd, tsConfigPath, [
      ...new Set(Object.values(entries).map((e) => dirname(e.source))),
    ])
    const uniqueProcessId =
      'dts-plugin:' + process.pid + tsConfigPath + autoDiscoverable
    const dtsPlugin = await memoizeDtsPluginByKey(uniqueProcessId)(
      tsCompilerOptions,
      tsConfigPath,
      bundleConfig.dts && bundleConfig.dts.respectExternal,
      cwd,
      autoDiscoverable,
    )
    typesPlugins.push(dtsPlugin)
  }

  const plugins: Plugin[] = (
    dts
      ? typesPlugins
      : [
          ...commonPlugins,
          preserveDirectives(),
          aliasPlugin,
          inlineCss({ exclude: /node_modules/ }),
          rawContent({ exclude: /node_modules/ }),
          nativeAddon(),
          isMerged
            ? binSources.size > 0 && prependShebang(binSources)
            : isBinEntry && prependShebang(entry),
          replace({
            values: inlineDefinedValues,
            preventAssignment: true,
          }),
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: nodeResolveExtensions,
          }),
          esmShim(),
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
            // Deal with mixed ESM and CJS modules, such as calling require() in ESM.
            // For relative paths, the module will be bundled;
            // For external libraries, the module will not be bundled.
            transformMixedEsModules: true,
          }),
          // If SWC emits @swc/helpers imports, warn when it's not installed.
          swcHelpersWarningPlugin({ cwd, pkg }),
        ]
  ).filter(isNotNull<Plugin>)

  // `externals` holds one entry per dependency plus one per sibling entry, and
  // rollup asks about every specifier in the graph — so this is scanned tens of
  // thousands of times. Precompute the exact-match set and the `<name>/` subpath
  // prefixes once instead of rebuilding a prefix string per candidate per call,
  // and memoize per specifier, since the same imports repeat across modules.
  const externalNames = new Set(externals)
  const externalPrefixes = externals.map((name) => name + '/')
  const externalCache = new Map<string, boolean>()

  function isExternal(id: string): boolean {
    if (externalNames.has(id)) return true
    for (let i = 0; i < externalPrefixes.length; i++) {
      if (id.startsWith(externalPrefixes[i])) return true
    }
    return false
  }

  return {
    input: mergedInputs ?? entry,
    external(id: string) {
      let cached = externalCache.get(id)
      if (cached === undefined) {
        cached = isExternal(id)
        externalCache.set(id, cached)
      }
      return cached
    },
    plugins,
    treeshake: 'recommended',
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
