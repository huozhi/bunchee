import type {
  PackageMetadata,
  BuncheeRollupConfig,
  BundleOptions,
  BundleConfig,
  ExportCondition,
} from './types'
import type { JsMinifyOptions } from '@swc/core'
import type { InputOptions, OutputOptions, Plugin } from 'rollup'
import type { TypescriptOptions } from './typescript'

import { resolve, dirname, extname } from 'path'
import { wasm } from '@rollup/plugin-wasm'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import shebang from 'rollup-plugin-preserve-shebang'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import createChunkSizeCollector from './plugins/size-plugin'
import {
  getTypings,
  getExportDist,
  getExportPaths,
  getExportConditionDist,
} from './exports'
import {
  isNotNull,
  getSourcePathFromExportPath,
  resolveSourceFile,
} from './utils'

const minifyOptions: JsMinifyOptions = {
  compress: true,
  format: {
    comments: 'some',
    wrapFuncArgs: false,
    preserveAnnotations: true,
  },
  mangle: {
    toplevel: true,
  },
}

// This can also be passed down as stats from top level
export const sizeCollector = createChunkSizeCollector()

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

function buildInputConfig(
  entry: string,
  pkg: PackageMetadata,
  options: BundleOptions,
  cwd: string,
  { tsConfigPath, tsCompilerOptions }: TypescriptOptions,
  dtsOnly: boolean
): InputOptions {
  const externals = options.noExternal
    ? []
    : [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
        .filter(<T>(n?: T): n is T => Boolean(n))
        .map((o: { [key: string]: any }): string[] => Object.keys(o))
        .reduce((a: string[], b: string[]) => a.concat(b), [])
        .concat((options.external ?? []).concat(pkg.name ? [pkg.name] : []))

  const { useTypescript, runtime, target: jscTarget, minify } = options
  const hasSpecifiedTsTarget = Boolean(
    tsCompilerOptions?.target && tsConfigPath
  )
  const sizePlugin = sizeCollector.plugin(cwd)
  const commonPlugins = [
    shebang(),
    sizePlugin,
  ]
  const plugins: Plugin[] = (
    dtsOnly
      ? [
          ...commonPlugins,
          useTypescript &&
            require('rollup-plugin-dts').default({
              compilerOptions: {
                ...tsCompilerOptions,
                declaration: true,
                noEmit: false,
                noEmitOnError: true,
                emitDeclarationOnly: true,
                checkJs: false,
                declarationMap: false,
                skipLibCheck: true,
                preserveSymlinks: false,
                target: 'esnext',
                module: 'esnext',
                incremental: false,
                jsx: tsCompilerOptions.jsx || 'react',
              },
            }),
        ]
      : [
          ...commonPlugins,
          replace({
            values: getBuildEnv(options.env || []),
            preventAssignment: true,
          }),
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: ['.mjs', '.cjs', '.js', '.json', '.node', '.jsx'],
          }),
          commonjs({
            include: /node_modules\//,
          }),
          json(),
          wasm(),
          swc({
            include: /\.(m|c)?[jt]sx?$/,
            exclude: 'node_modules',
            tsconfig: tsConfigPath,
            jsc: {
              ...(!hasSpecifiedTsTarget && {
                target: jscTarget,
              }),
              loose: true, // Use loose mode
              externalHelpers: false,
              parser: {
                syntax: useTypescript ? 'typescript' : 'ecmascript',
                [useTypescript ? 'tsx' : 'jsx']: true,
                privateMethod: true,
                classPrivateProperty: true,
                exportDefaultFrom: true,
              },
              ...(minify && {
                minify: {
                  ...minifyOptions,
                  sourceMap: options.sourcemap,
                },
              }),
            },
            sourceMaps: options.sourcemap,
            inlineSourcesContent: false,
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
      if (dtsOnly && code === 'EMPTY_BUNDLE') return
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
  tsCompilerOptions: TypescriptOptions['tsCompilerOptions']
) {
  let hasEsm = false
  for (const key in exportPaths) {
    const exportInfo = exportPaths[key]
    if (exportInfo.import || exportInfo.module) {
      hasEsm = true
      break
    }
  }
  return Boolean(hasEsm || tsCompilerOptions?.esModuleInterop)
}

function buildOutputConfigs(
  pkg: PackageMetadata,
  options: BundleOptions,
  cwd: string,
  { tsCompilerOptions }: TypescriptOptions,
  dtsOnly: boolean
): OutputOptions {
  const { format, exportCondition } = options
  const exportPaths = getExportPaths(pkg)

  // Add esm mark and interop helper if esm export is detected
  const useEsModuleMark = hasEsmExport(exportPaths, tsCompilerOptions)
  const typings: string | undefined = getTypings(pkg)
  const file = options.file && resolve(cwd, options.file)

  const dtsDir = typings
    ? dirname(resolve(cwd, typings))
    : resolve(cwd, 'dist')
  // file base name without extension
  const name = file
    ? file.replace(new RegExp(`${extname(file)}$`), '')
    : undefined

  const dtsFile = file
    ? name + '.d.ts'
    : exportCondition?.name
    ? resolve(
        dtsDir,
        (exportCondition.name === '.' ? 'index' : exportCondition.name) +
          '.d.ts'
      )
    : typings && resolve(cwd, typings)

  // If there's dts file, use `output.file`
  const dtsPathConfig = dtsFile ? { file: dtsFile } : { dir: dtsDir }
  return {
    name: pkg.name || name,
    ...(dtsOnly ? dtsPathConfig : { file: file }),
    format,
    exports: 'named',
    esModule: useEsModuleMark || 'if-default-prop',
    interop: 'auto',
    freeze: false,
    strict: false,
    sourcemap: options.sourcemap,
  }
}

// build configs for each entry from package exports
export async function buildEntryConfig(
  pkg: PackageMetadata,
  bundleConfig: BundleConfig,
  cwd: string,
  tsOptions: TypescriptOptions,
  dtsOnly: boolean
): Promise<BuncheeRollupConfig[]> {
  const packageExports = (pkg.exports || {}) as Record<string, ExportCondition>
  const configs = Object.keys(packageExports).map(async (entryExport) => {
    const source = await getSourcePathFromExportPath(
      cwd,
      entryExport
    )
    if (!source) return undefined
    if (dtsOnly && !tsOptions?.tsConfigPath) return

    bundleConfig.exportCondition = {
      source,
      name: entryExport,
      export: packageExports[entryExport],
    }

    const entry = resolveSourceFile(cwd!, source)
    const rollupConfig = buildConfig(entry, pkg, bundleConfig, cwd, tsOptions, dtsOnly)
    return rollupConfig
  })

  return (await Promise.all(configs)).filter(<T>(n?: T): n is T => Boolean(n))
}

function buildConfig(
  entry: string,
  pkg: PackageMetadata,
  bundleConfig: BundleConfig,
  cwd: string,
  tsOptions: TypescriptOptions,
  dtsOnly: boolean
): BuncheeRollupConfig {
  const { file } = bundleConfig
  const useTypescript = Boolean(tsOptions.tsConfigPath)
  const options = { ...bundleConfig, useTypescript }
  const inputOptions = buildInputConfig(entry, pkg, options, cwd, tsOptions, dtsOnly)
  const outputExports = options.exportCondition
    ? getExportConditionDist(pkg, options.exportCondition.export, cwd)
    : getExportDist(pkg, cwd)

  let outputConfigs = []

  // Generate dts job - single config
  if (dtsOnly) {
    outputConfigs = [
      buildOutputConfigs(
        pkg,
        {
          ...bundleConfig,
          format: 'es',
          useTypescript,
        },
        cwd,
        tsOptions,
        dtsOnly
      ),
    ]
  } else {
    // multi outputs with specified format
    outputConfigs = outputExports.map((exportDist) => {
      return buildOutputConfigs(
        pkg,
        {
          ...bundleConfig,
          file: exportDist.file,
          format: exportDist.format,
          useTypescript,
        },
        cwd,
        tsOptions,
        dtsOnly
      )
    })
    // CLI output option is always prioritized
    if (file) {
      const fallbackFormat = outputExports[0]?.format
      outputConfigs = [
        buildOutputConfigs(
          pkg,
          {
            ...bundleConfig,
            file,
            format: bundleConfig.format || fallbackFormat,
            useTypescript,
          },
          cwd,
          tsOptions,
          dtsOnly
        ),
      ]
    }
  }

  return {
    input: inputOptions,
    output: outputConfigs,
    exportName: options.exportCondition?.name || '.',
  }
}

export default buildConfig
