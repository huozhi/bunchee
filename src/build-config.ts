import type {
  PackageMetadata,
  BuncheeRollupConfig,
  BundleOptions,
  BundleConfig,
  ParsedExportCondition,
  ExportPaths,
  FullExportCondition,
} from './types'
import type { InputOptions, OutputOptions, Plugin } from 'rollup'
import { type TypescriptOptions } from './typescript'

import { resolve, dirname, extname, join } from 'path'
import { wasm } from '@rollup/plugin-wasm'
import { swc } from 'rollup-plugin-swc3'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import esmShim from '@rollup/plugin-esm-shim'
import { sizeCollector } from './plugins/size-plugin'
import { inlineCss } from './plugins/inline-css'
import { rawContent } from './plugins/raw-plugin'
import preserveDirectives from 'rollup-preserve-directives'
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
  nonNullable,
} from './utils'
import {
  availableExportConventions,
  availableESExtensionsRegex,
  dtsExtensions,
} from './constants'
import { logger } from './logger'

const swcMinifyOptions = {
  compress: true,
  format: {
    comments: 'some',
    // wrapFuncArgs: false,
    // preserveAnnotations: true,
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

async function buildInputConfig(
  entry: string,
  pkg: PackageMetadata,
  options: BundleOptions,
  cwd: string,
  { tsConfigPath, tsCompilerOptions }: TypescriptOptions,
  dts: boolean,
): Promise<InputOptions> {
  const hasNoExternal = options.external === null
  const externals = hasNoExternal
    ? []
    : [pkg.peerDependencies, pkg.dependencies, pkg.peerDependenciesMeta]
        .filter(<T>(n?: T): n is T => Boolean(n))
        .map((o: { [key: string]: any }): string[] => Object.keys(o))
        .reduce((a: string[], b: string[]) => a.concat(b), [])
        .concat((options.external ?? []).concat(pkg.name ? [pkg.name] : []))

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

  const sizePlugin = sizeCollector.plugin(cwd)
  // common plugins for both dts and ts assets that need to be processed
  const commonPlugins = [sizePlugin]

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
          replace({
            values: getBuildEnv(options.env || []),
            preventAssignment: true,
          }),
          nodeResolve({
            preferBuiltins: runtime === 'node',
            extensions: ['.mjs', '.cjs', '.js', '.json', '.node', '.jsx'],
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

function buildOutputConfigs(
  pkg: PackageMetadata,
  exportPaths: ExportPaths,
  options: BundleOptions,
  exportCondition: ParsedExportCondition,
  cwd: string,
  { tsCompilerOptions }: TypescriptOptions,
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

  // If there's dts file, use `output.file`
  const dtsPathConfig = dtsFile ? { file: dtsFile } : { dir: dtsDir }
  return {
    name: pkg.name || name,
    ...(dts ? dtsPathConfig : { file: file }),
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
  entryPath: string,
  exportPaths: ExportPaths,
  bundleConfig: BundleConfig,
  cwd: string,
  tsOptions: TypescriptOptions,
  dts: boolean,
): Promise<BuncheeRollupConfig[]> {
  const configs: Promise<BuncheeRollupConfig | undefined>[] = []
  Object.keys(exportPaths).forEach(async (entryExport) => {
    // TODO: improve the source detection
    const exportCond = exportPaths[entryExport]
    const buildConfigs = [
      createBuildConfig('', exportCond), // default config
    ]

    // For dts job, only build the default config.
    // For assets job, build all configs.
    if (!dts) {
      if (exportCond['edge-light']) {
        buildConfigs.push(createBuildConfig('edge-light', exportCond))
      }
      if (exportCond['react-server']) {
        buildConfigs.push(createBuildConfig('react-server', exportCond))
      }
      if (exportCond['react-native']) {
        buildConfigs.push(createBuildConfig('react-native', exportCond))
      }
    }

    async function createBuildConfig(
      exportType: string,
      exportCondRef: FullExportCondition,
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
      const source =
        entryPath ||
        (await getSourcePathFromExportPath(cwd, entryExport, exportType))

      if (!source) return undefined

      const exportCondition: ParsedExportCondition = {
        source,
        name: entryExport,
        export: exportCondForType,
      }

      const entry = resolveSourceFile(cwd!, source)
      const rollupConfig = buildConfig(
        entry,
        pkg,
        exportPaths,
        bundleConfig,
        exportCondition,
        cwd,
        tsOptions,
        dts,
      )
      return rollupConfig
    }

    configs.push(...buildConfigs)
  })

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
      const binEntryConfig = buildConfig(
        binEntryPath,
        pkg,
        binExportPaths,
        bundleConfig,
        {
          source: binEntryPath,
          name: binName,
          export: binExportPaths[binName],
        },
        cwd,
        tsOptions,
        dts,
      )
      configs.push(binEntryConfig)
    }
  }

  return (await Promise.all(configs)).filter(nonNullable)
}

async function buildConfig(
  entry: string,
  pkg: PackageMetadata,
  exportPaths: ExportPaths,
  bundleConfig: BundleConfig,
  exportCondition: ParsedExportCondition,
  cwd: string,
  tsOptions: TypescriptOptions,
  dts: boolean,
): Promise<BuncheeRollupConfig> {
  const { file } = bundleConfig
  const useTypescript = Boolean(tsOptions.tsConfigPath)
  const options = { ...bundleConfig, useTypescript }
  const inputOptions = await buildInputConfig(
    entry,
    pkg,
    options,
    cwd,
    tsOptions,
    dts,
  )
  const outputExports = getExportConditionDist(pkg, exportCondition, cwd)

  let outputConfigs = []

  // Generate dts job - single config
  if (dts) {
    const typeOutputExports = getExportTypeDist(exportCondition, cwd)
    outputConfigs = typeOutputExports.map((v) =>
      buildOutputConfigs(
        pkg,
        exportPaths,
        {
          ...bundleConfig,
          format: 'es',
          useTypescript,
          file: v,
        },
        exportCondition,
        cwd,
        tsOptions,
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

export default buildConfig
