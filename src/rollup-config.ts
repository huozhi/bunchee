import type { PackageMetadata, BuncheeRollupConfig, ExportCondition, CliArgs, BundleOptions, ExportType } from './types'
import type { JsMinifyOptions } from '@swc/core'
import fs from 'fs'
import { resolve, extname, dirname } from 'path'
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
      logger.error('Could not load TypeScript compiler. Try `yarn add --dev typescript`')
      process.exit(1)
    }
  }
  return ts
}

function getDistPath(distPath: string) {
  return resolve(config.rootDir, distPath)
}

function createInputConfig(
  entry: string,
  pkg: PackageMetadata,
  options: BundleOptions
): InputOptions {
  const externals = [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: any }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[])
    .concat((options.external ?? []).concat(pkg.name ? [pkg.name] : []))

  const { useTypescript, runtime, minify = false, exportCondition } = options
  const typings: string | undefined = pkg.types || pkg.typings
  const cwd: string = config.rootDir

  let tsPath: string | undefined
  let declarationDir: string | undefined
  if (useTypescript) {
    const tsconfig = resolve(cwd, 'tsconfig.json')
    tsPath = fs.existsSync(tsconfig) ? tsconfig : undefined

    if (typings) {
      declarationDir = dirname(resolve(cwd, typings))
    }

    // Generate `declarationDir` based on the dist files of export condition
    if (exportCondition) {
      const exportConditionDistFolder =
        dirname(
          typeof exportCondition.export === 'string'
            ? exportCondition.export
            : Object.values(exportCondition.export)[0]
          )
      declarationDir = resolve(
        config.rootDir,
        exportConditionDistFolder
      )
    }
  }

  const isMainExport = !exportCondition || exportCondition.name === '.'

  const plugins: Plugin[] = [
    nodeResolve({
      preferBuiltins: runtime === 'node',
      extensions: ['.mjs', '.js', '.json', '.node', '.jsx'],
    }),
    commonjs({
      include: /node_modules\//,
    }),
    json(),
    shebang(),
    // Use typescript only emit types once for main export compilation
    useTypescript && isMainExport &&
      require('@rollup/plugin-typescript')({
        tsconfig: tsPath,
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
          declarationDir,
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
    // dir: dirname(file),
    // entryFileNames: basename(file),
    file: file,
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

  // default fallback to output `dist/index.js` in default esm format
  if (dist.length === 0) {
    dist.push({ format: 'esm', file: getDistPath('dist/index.js') })
  }
  return dist
}

function getSubExportDist(pkg: PackageMetadata, exportCondition: ExportCondition) {
  // const pkgExports = pkg.exports || {}
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  // "exports": "..."
  if (typeof exportCondition === 'string') {
    dist.push({ format: pkg.type === 'module' ? 'esm' : 'cjs', file: getDistPath(exportCondition) })
  } else {
    // "./<subexport>": { }
    const subExports = exportCondition // pkgExports[subExport]
    // Ignore json exports, like "./package.json"
    // if (subExport.endsWith('.json')) return dist
    if (typeof subExports === 'string') {
      dist.push({ format: 'esm', file: getDistPath(subExports) })
    } else {
      if (subExports.require) {
        dist.push({ format: 'cjs', file: getDistPath(subExports.require) })
      }
      if (subExports.import) {
        dist.push({ format: 'esm', file: getDistPath(subExports.import) })
      }
    }
  }
  return dist
}

function createRollupConfig(
  entry: string,
  pkg: PackageMetadata,
  cliArgs: CliArgs
): BuncheeRollupConfig {
  const { file } = cliArgs
  const ext = extname(entry)
  const useTypescript: boolean = ext === '.ts' || ext === '.tsx'
  const options = { ...cliArgs, useTypescript }

  const inputOptions = createInputConfig(entry, pkg, options)
  const outputExports = options.exportCondition
    ? getSubExportDist(pkg, options.exportCondition.export)
    : getExportDist(pkg)

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
    const format = outputExports[0]?.format
    outputConfigs = [
      createOutputOptions(
        {
          ...cliArgs,
          file,
          format: format || cliArgs.format,
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
