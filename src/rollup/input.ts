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
import { posix } from 'path'
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
import { aliasEntries } from '../plugins/alias-plugin'
import { prependShebang } from '../plugins/prepend-shebang'
import { swcHelpersWarningPlugin } from '../plugins/swc-helpers-warning-plugin'
import { memoizeByKey } from '../lib/memoize'
import { convertCompilerOptions } from '../typescript'
import {
  availableESExtensionsRegex,
  disabledWarnings,
  nodeResolveExtensions,
} from '../constants'

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
    tsconfig: tsConfigPath,
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
    format: aliasFormat,
    isESMPkg: isESModulePackage(pkg.type),
    exportCondition,
    dts,
    cwd,
  })
  const commonPlugins = [json(), sizePlugin]

  const typesPlugins = [
    aliasPlugin,
    ...commonPlugins,
    inlineCss({ skip: true }),
  ]

  if (useTypeScript) {
    // Each process should be unique
    // Each package build should be unique
    // Composing above factors into a unique cache key to retrieve the memoized dts plugin with tsconfigs
    const uniqueProcessId = 'dts-plugin:' + process.pid + tsConfigPath
    const dtsPlugin = await memoizeDtsPluginByKey(uniqueProcessId)(
      tsCompilerOptions,
      tsConfigPath,
      bundleConfig.dts && bundleConfig.dts.respectExternal,
      cwd,
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
          isBinEntry && prependShebang(entry),
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
            // Deal with mixed ESM and CJS modules, such as calling require() in ESM.
            // For relative paths, the module will be bundled;
            // For external libraries, the module will not be bundled.
            transformMixedEsModules: true,
          }),
          // If SWC emits @swc/helpers imports, warn when it's not installed.
          swcHelpersWarningPlugin({ cwd, pkg }),
        ]
  ).filter(isNotNull<Plugin>)

  return {
    input: entry,
    external(id: string) {
      return externals.some((name) => id === name || id.startsWith(name + '/'))
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
