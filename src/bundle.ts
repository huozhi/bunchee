import type {
  RollupWatcher,
  RollupWatchOptions,
  OutputOptions,
  RollupBuild,
  RollupOutput,
} from 'rollup'
import type {
  BuncheeRollupConfig,
  BundleConfig,
  ExportPaths,
} from './types'

import fs from 'fs/promises'
import { resolve, relative } from 'path'
import { watch as rollupWatch, rollup } from 'rollup'
import { buildEntryConfig } from './build-config'
import {
  getPackageMeta,
  logger,
  fileExists,
  getSourcePathFromExportPath,
  getExportPath,
} from './utils'
import { constructDefaultExportCondition, getExportPaths, getPackageType, getTypeFilePath } from './exports'
import type { BuildMetadata } from './types'
import { TypescriptOptions, resolveTsConfig } from './typescript'
import { logSizeStats } from './logging'

function assignDefault(
  options: BundleConfig,
  name: keyof BundleConfig,
  defaultValue: any
) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function hasMultiEntryExport(exportPaths: ExportPaths): boolean {
  const exportKeys = (
   Object.keys(exportPaths)
  ).filter((key) => key !== './package.json')

  return (
    exportKeys.length > 0 && exportKeys.every((name) => name.startsWith('.'))
  )
}

async function bundle(
  entryPath: string,
  { cwd: _cwd, ...options }: BundleConfig = {}
): Promise<any> {
  const cwd = resolve(process.cwd(), _cwd || '')
  assignDefault(options, 'format', 'es')
  assignDefault(options, 'minify', false)
  assignDefault(options, 'target', 'es2015')

  const pkg = await getPackageMeta(cwd)
  const packageType = getPackageType(pkg)
  const exportPaths = getExportPaths(pkg)

  const exportKeys = (
    Object.keys(exportPaths)
   ).filter((key) => key !== './package.json')
  // const exportPathsLength = Object.keys(exportPaths).length
  const isMultiEntries = hasMultiEntryExport(exportPaths) // exportPathsLength > 1

  const tsConfig = await resolveTsConfig(cwd)
  const hasTsConfig = Boolean(tsConfig?.tsConfigPath)
  const defaultTsOptions: TypescriptOptions = {
    tsConfigPath: tsConfig?.tsConfigPath,
    tsCompilerOptions: tsConfig?.tsCompilerOptions || {},
  }

  // Handle single entry file
  if (!isMultiEntries) {
    // Use specified string file path if possible, then fallback to the default behavior entry picking logic
    // e.g. "exports": "./dist/index.js" -> use "./index.<ext>" as entry
    entryPath =
      entryPath ||
      (await getSourcePathFromExportPath(cwd, '.', 'default')) ||
      ''
  }

  if (entryPath) {
    let mainEntryPath: string | undefined
    let typesEntryPath: string | undefined
    // with -o option
    if (options.file) {
      mainEntryPath = options.file
    }
    // without -o, use default path dist
    else if (exportKeys.length === 0) {
      mainEntryPath = resolve(cwd, 'dist/index.js')
    }

    if (mainEntryPath) {
      if (options.dts) {
        typesEntryPath = getTypeFilePath(mainEntryPath, undefined, cwd)
      }

      exportPaths['.'] = constructDefaultExportCondition({
        main: mainEntryPath,
        types: typesEntryPath,
      }, packageType)
    }
  }

  const bundleOrWatch = (
    rollupConfig: BuncheeRollupConfig
  ): Promise<RollupWatcher | RollupOutput[] | void> => {
    const { input, exportName } = rollupConfig
    const exportPath = getExportPath(pkg, cwd, exportName)
    // Log original entry file relative path
    const source =
      typeof input.input === 'string'
        ? relative(cwd, input.input)
        : exportPath

    const buildMetadata: BuildMetadata = {
      source,
    }
    if (options.watch) {
      return Promise.resolve(runWatch(rollupConfig, buildMetadata))
    }
    return runBundle(rollupConfig)
  }

  const hasSpecifiedEntryFile = entryPath
    ? (await fileExists(entryPath)) && (await fs.stat(entryPath)).isFile()
    : false

  if (!hasSpecifiedEntryFile && !isMultiEntries) {
    const err = new Error(`Entry file \`${entryPath}\` is not existed`)
    err.name = 'NOT_EXISTED'
    return Promise.reject(err)
  }

  let result
  const buildConfigs = await buildEntryConfig(
    pkg,
    entryPath,
    exportPaths,
    options,
    cwd,
    defaultTsOptions,
    false,
  )
  const assetsJobs = buildConfigs.map((rollupConfig) =>
    bundleOrWatch(rollupConfig)
  )

  const typesJobs = hasTsConfig
    ? (
        await buildEntryConfig(pkg, entryPath, exportPaths, options, cwd, defaultTsOptions, true)
      ).map((rollupConfig) => bundleOrWatch(rollupConfig))
    : []

  result = await Promise.all(assetsJobs.concat(typesJobs))

  logSizeStats()
  return result
}

function runWatch(
  { input, output }: BuncheeRollupConfig,
  metadata: BuildMetadata
): RollupWatcher {
  const watchOptions: RollupWatchOptions[] = [
    {
      ...input,
      output: output,
      watch: {
        exclude: ['node_modules/**'],
      },
    },
  ]
  const watcher = rollupWatch(watchOptions)

  watcher.on('event', (event) => {
    switch (event.code) {
      case 'ERROR': {
        return onError(event.error)
      }
      case 'START': {
        logger.log(`Start building ${metadata.source} ...`)
        break
      }
      case 'END': {
        break
      }
      default:
        return
    }
  })
  return watcher
}

function runBundle(
  { input, output }: BuncheeRollupConfig
) {
  return rollup(input)
    .then((bundle: RollupBuild) => {
      const writeJobs = output.map((options: OutputOptions) =>
        bundle.write(options)
      )
      return Promise.all(writeJobs)
    }, onError)
}

function onError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stderr.write(error.frame + '\n')
  }
  // filter out the rollup plugin error information such as loc/frame/code...
  const err = new Error(error.message)
  err.stack = error.stack
  throw err
}

export default bundle
