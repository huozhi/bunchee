import type { PackageMetadata, BuncheeRollupConfig, CliArgs, BundleOptions } from './types'
import type { JsMinifyOptions } from '@swc/core'
import type { InputOptions, OutputOptions, Plugin } from 'rollup'
import fs from 'fs'
import { resolve, dirname, extname } from 'path'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import shebang from 'rollup-plugin-preserve-shebang'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import config from './config'
import {
  getTypings,
  getExportDist,
  getExportPaths,
  getExportConditionDist,
} from './exports'
import { exit, isTypescript, isNotNull } from './utils'

type TypescriptOptions = {
  tsConfigPath: string | undefined
  tsCompilerOptions: any
  dtsOnly: boolean
}

import { Module } from 'module'

const minifyOptions: JsMinifyOptions = {
  compress: true,
  format: {
    comments: 'some',
    wrapFuncArgs: false,
    preserveAnnotations: true,
  },
  mangle: true,
}

let hasLoggedTsWarning = false
function resolveTypescript(cwd: string) {
  let ts
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    ts = m.require('typescript')
  } catch (_) {
    console.error(_)
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      exit('Could not load TypeScript compiler. Try to install `typescript` as dev dependency')
    }
  }
  return ts
}


function buildInputConfig(
  entry: string,
  pkg: PackageMetadata,
  options: BundleOptions,
  { tsConfigPath, tsCompilerOptions, dtsOnly }: TypescriptOptions
): InputOptions {
  const externals = [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: any }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[])
    .concat((options.external ?? []).concat(pkg.name ? [pkg.name] : []))

  const { useTypescript, runtime, target: jscTarget, minify } = options
  const plugins: Plugin[] = (
    dtsOnly
      ? [
          shebang(),
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
                jsx: tsCompilerOptions?.jsx || 'react',
              },
            }),
        ]
      : [
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: ['.mjs', '.js', '.json', '.node', '.jsx'],
          }),
          commonjs({
            include: /node_modules\//,
          }),
          json(),
          shebang(),
          swc({
            include: /\.(m|c)?[jt]sx?$/,
            exclude: 'node_modules',
            tsconfig: tsConfigPath,
            jsc: {
              target: jscTarget,
              loose: true, // Use loose mode
              externalHelpers: false,
              parser: {
                syntax: useTypescript ? 'typescript' : 'ecmascript',
                [useTypescript ? 'tsx' : 'jsx']: true,
                privateMethod: true,
                classPrivateProperty: true,
                exportDefaultFrom: true,
              },
              ...(minify && { minify: { ...minifyOptions, sourceMap: options.sourcemap } }),
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
      if (['MIXED_EXPORTS', 'PREFER_NAMED_EXPORTS', 'UNRESOLVED_IMPORT', 'THIS_IS_UNDEFINED'].includes(code)) return
      // If the circular dependency warning is from node_modules, ignore it
      if (code === 'CIRCULAR_DEPENDENCY' && /Circular dependency: node_modules/.test(warning.message)) {
        return
      }
      warn(warning)
    },
  }
}

function buildOutputConfigs(
  options: BundleOptions,
  pkg: PackageMetadata,
  { tsCompilerOptions, dtsOnly }: TypescriptOptions
): OutputOptions {
  const { format, exportCondition } = options
  const exportPaths = getExportPaths(pkg)

  // respect if tsconfig.json has `esModuleInterop` config;
  // add ESModule mark if cjs and ESModule are both generated;
  // TODO: support `import` in exportCondition
  const mainExport = exportPaths['.']
  const useEsModuleMark = Boolean(tsCompilerOptions.esModuleInterop || (mainExport.main && mainExport.module))
  const typings: string | undefined = getTypings(pkg)
  const file = options.file && resolve(config.rootDir, options.file)

  const dtsDir = typings ? dirname(resolve(config.rootDir, typings)) : resolve(config.rootDir, 'dist')
  // file base name without extension
  const name = file ? file.replace(new RegExp(`${extname(file)}$`), '') : undefined

  const dtsFile =
    file ? name + '.d.ts' :
    exportCondition?.name
      ? resolve(dtsDir, (exportCondition.name === '.' ? 'index' : exportCondition.name) + '.d.ts')
      : (typings && resolve(config.rootDir, typings))

  // If there's dts file, use `output.file`
  const dtsPathConfig = dtsFile ? { file: dtsFile } : { dir: dtsDir }
  return {
    name: pkg.name || name,
    ...(dtsOnly ? dtsPathConfig : { file: file }),
    format,
    exports: 'named',
    esModule: useEsModuleMark,
    freeze: false,
    strict: false,
    sourcemap: options.sourcemap,
  }
}

function buildConfig(entry: string, pkg: PackageMetadata, cliArgs: CliArgs, dtsOnly: boolean): BuncheeRollupConfig {
  const { file } = cliArgs
  const useTypescript = isTypescript(entry)
  const options = { ...cliArgs, useTypescript }
  let tsCompilerOptions = {} as any
  let tsConfigPath: string | undefined

  if (useTypescript) {
    const ts = resolveTypescript(config.rootDir)
    tsConfigPath = resolve(config.rootDir, 'tsconfig.json')
    if (fs.existsSync(tsConfigPath)) {
      const tsconfigJSON = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config
      tsCompilerOptions = ts.parseJsonConfigFileContent(tsconfigJSON, ts.sys, './').options
    } else {
      tsConfigPath = undefined
      exit('tsconfig.json is missing in your project directory')
    }
  }

  const typescriptOptions: TypescriptOptions = {
    dtsOnly,
    tsConfigPath,
    tsCompilerOptions,
  }

  const inputOptions = buildInputConfig(entry, pkg, options, typescriptOptions)
  const outputExports = options.exportCondition
    ? getExportConditionDist(pkg, options.exportCondition.export)
    : getExportDist(pkg)

  let outputConfigs = []

  // Generate dts job - single config
  if (dtsOnly) {
    outputConfigs = [
      buildOutputConfigs(
        {
          ...cliArgs,
          format: 'es',
          useTypescript,
        },
        pkg,
        typescriptOptions
      ),
    ]
  } else {
    // multi outputs with specified format
    outputConfigs = outputExports.map((exportDist) => {
      return buildOutputConfigs(
        {
          ...cliArgs,
          file: exportDist.file,
          format: exportDist.format,
          useTypescript,
        },
        pkg,
        typescriptOptions
      )
    })
    // CLI output option is always prioritized
    if (file) {
      const fallbackFormat = outputExports[0]?.format
      outputConfigs = [
        buildOutputConfigs(
          {
            ...cliArgs,
            file,
            format: cliArgs.format || fallbackFormat,
            useTypescript,
          },
          pkg,
          typescriptOptions
        ),
      ]
    }
  }

  return {
    input: inputOptions,
    output: outputConfigs,
    exportName: options.exportCondition?.name || '.',
    dtsOnly,
  }
}

export default buildConfig
