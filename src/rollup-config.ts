import type { PackageMetadata, BuncheeRollupConfig, ExportCondition, CliArgs, BundleOptions, ExportType } from './types'
import type { JsMinifyOptions } from '@swc/core'
import fs from 'fs'
import { resolve, extname, dirname, basename } from 'path'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import shebang from 'rollup-plugin-preserve-shebang'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { InputOptions, OutputOptions, Plugin } from 'rollup'
import config from './config'
import { logger } from './utils'

const { Module } = require('module')

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
function resolveTypescript() {
  let ts
  const m = new Module('', null)
  m.paths = Module._nodeModulePaths(config.rootDir)
  try {
    ts = m.require('typescript')
  } catch (_) {
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      logger.warn('Could not load TypeScript compiler. Try `yarn add --dev typescript`')
    }
  }
  return ts
}

function getDistPath(distPath: string) {
  return resolve(config.rootDir, distPath)
}

function createInputConfig(entry: string, pkg: PackageMetadata, options: BundleOptions): InputOptions {
  const externals = [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: any }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[])
    .concat((options.external ?? []).concat(pkg.name ? [pkg.name] : []))

  const { useTypescript, target, minify = false } = options
  const typings: string | undefined = pkg.types || pkg.typings
  const cwd: string = config.rootDir

  const plugins: Plugin[] = [
    nodeResolve({
      preferBuiltins: target === 'node',
      extensions: ['.mjs', '.js', '.json', '.node', '.jsx'],
    }),
    commonjs({
      include: /node_modules\//,
    }),
    json(),
    shebang(),
    useTypescript &&
      require('@rollup/plugin-typescript')({
        tsconfig: (() => {
          const tsconfig = resolve(cwd, 'tsconfig.json')
          return fs.existsSync(tsconfig) ? tsconfig : undefined
        })(),
        typescript: resolveTypescript(),
        // override options
        jsx: 'react',
        module: 'ES6',
        target: 'ES5',
        // Disable `noEmitOnError` for watch mode to avoid plugin error
        noEmitOnError: !options.watch,
        sourceMap: options.sourcemap,
        declaration: !!typings,
        // Only emit types, use swc to emit js
        emitDeclarationOnly: true,
        ...(!!typings && {
          declarationDir: dirname(resolve(cwd, typings)),
        }),
      }),
    swc({
      include: /\.(m|c)?[jt]sx?$/,
      exclude: 'node_modules',
      tsconfig: 'tsconfig.json',
      jsc: {
        target: 'es5',

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
  ].filter((n: Plugin | false): n is Plugin => Boolean(n))

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
      if (['MIXED_EXPORTS', 'PREFER_NAMED_EXPORTS', 'THIS_IS_UNDEFINED'].includes(code)) return
      // If the circular dependency warning is from node_modules, ignore it
      if (code === 'CIRCULAR_DEPENDENCY' && /Circular dependency: node_modules/.test(warning.message)) {
        return
      }
      warn(warning)
    },
  }
}

function createOutputOptions(options: BundleOptions, pkg: PackageMetadata): OutputOptions {
  const { format, useTypescript } = options
  let tsCompilerOptions = {} as any

  if (useTypescript) {
    const ts = resolveTypescript()
    const tsconfigPath = resolve(config.rootDir, 'tsconfig.json')
    if (fs.existsSync(tsconfigPath)) {
      const tsconfigJSON = ts.readConfigFile(tsconfigPath, ts.sys.readFile).config
      tsCompilerOptions = ts.parseJsonConfigFileContent(tsconfigJSON, ts.sys, './').options
    }
  }

  const exportPaths = getExportPaths(pkg)

  // respect if tsconfig.json has `esModuleInterop` config;
  // add esmodule mark if cjs and esmodule are both generated;

  const useEsModuleMark = Boolean(tsCompilerOptions.esModuleInterop || (exportPaths.main && exportPaths.module))

  const file = resolve(options.file!)
  return {
    name: pkg.name,
    dir: dirname(file),
    entryFileNames: basename(file),
    format,
    exports: 'named',
    esModule: useEsModuleMark && format !== 'umd',
    freeze: false,
    strict: false,
    sourcemap: options.sourcemap,
  }
}

function findExport(field: any): string | undefined {
  if (!field) return
  if (typeof field === 'string') return field
  const value = field['.'] || field['import'] || field['module'] || field['default']
  return findExport(value)
}

function parseExport(exportsCondition: ExportCondition) {
  const paths: Record<Exclude<ExportType, 'default'>, string | undefined> = {}

  if (typeof exportsCondition === 'string') {
    paths.export = exportsCondition
  } else {
    paths.main = paths.main || exportsCondition['require'] || exportsCondition['node'] || exportsCondition['default']
    paths.module = paths.module || exportsCondition['module']
    paths.export = findExport(exportsCondition)
  }
  return paths
}

function getExportPaths(pkg: PackageMetadata) {
  const pathsMap: Record<string, Record<string, string | undefined>> = {}
  const mainExport: Record<Exclude<ExportType, 'default'>, string> = {}
  if (pkg.main) {
    mainExport.main = pkg.main
  }
  if (pkg.module) {
    mainExport.module = pkg.module
  }
  pathsMap['.'] = mainExport

  const { exports: exportsConditions } = pkg
  if (exportsConditions) {
    if (typeof exportsConditions === 'string') {
      mainExport.export = exportsConditions
    } else {
      const exportKeys = Object.keys(exportsConditions)
      if (exportKeys.some((key) => key.startsWith('.'))) {
        exportKeys.forEach((subExport) => {
          pathsMap[subExport] = parseExport(exportsConditions[subExport])
        })
      } else {
        Object.assign(mainExport, parseExport(exportsConditions as ExportCondition))
      }
    }
  }
  pathsMap['.'] = mainExport

  return pathsMap
}

function getExportDist(pkg: PackageMetadata) {
  const paths = getExportPaths(pkg)['.']
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  if (paths.main) {
    dist.push({ format: 'cjs', file: getDistPath(paths.main) })
  }
  if (paths.module) {
    dist.push({ format: 'esm', file: getDistPath(paths.module) })
  }
  if (paths.export) {
    dist.push({ format: 'esm', file: getDistPath(paths.export) })
  }

  // default fallback to output `dist/index.js` in cjs format
  if (dist.length === 0) {
    dist.push({ format: 'cjs', file: getDistPath('dist/index.js') })
  }
  return dist
}

function getSubExportDist(pkg: PackageMetadata, subExport: string) {
  const pkgExports = pkg.exports || {}
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  // "exports": "..."
  if (typeof pkgExports === 'string') {
    dist.push({ format: pkg.type === 'module' ? 'esm' : 'cjs', file: getDistPath(pkgExports) })
  } else {
    // "exports": { }
    const exports = pkgExports[subExport]
    // Ignore json exports, like "./package.json"
    if (subExport.endsWith('.json')) return dist
    if (typeof exports === 'string') {
      dist.push({ format: 'esm', file: getDistPath(exports) })
    } else {
      if (exports.require) {
        dist.push({ format: 'cjs', file: getDistPath(exports.require) })
      }
      if (exports.import) {
        dist.push({ format: 'esm', file: getDistPath(exports.import) })
      }
    }
  }
  return dist
}

function createRollupConfig(
  entry: string,
  pkg: PackageMetadata,
  cliArgs: CliArgs,
  entryExport?: string
): BuncheeRollupConfig {
  const { file, format } = cliArgs
  const ext = extname(entry)
  const useTypescript: boolean = ext === '.ts' || ext === '.tsx'
  const options = { ...cliArgs, useTypescript }

  const inputOptions = createInputConfig(entry, pkg, options)

  const outputExports = entryExport ? getSubExportDist(pkg, entryExport) : getExportDist(pkg)

  let outputConfigs = outputExports.map((exportDist) => {
    return createOutputOptions(
      {
        ...cliArgs,
        file: exportDist.file,
        format: exportDist.format,
        useTypescript,
      },
      pkg
    )
  })

  // CLI output option is always prioritized
  if (file) {
    outputConfigs = [
      createOutputOptions(
        {
          ...cliArgs,
          file,
          format,
          useTypescript,
        },
        pkg
      ),
    ]
  }

  return {
    input: inputOptions,
    output: outputConfigs,
  }
}

export default createRollupConfig
