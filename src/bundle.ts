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
  PackageMetadata,
} from './types'

import fs from 'fs/promises'
import { resolve, relative } from 'path'
import { watch as rollupWatch, rollup } from 'rollup'
import buildConfig, { buildEntryConfig, sizeCollector } from './build-config'
import {
  getPackageMeta,
  logger,
  fileExists,
  getSourcePathFromExportPath,
  getExportPath,
} from './utils'
import { getTypings } from './exports'
import type { BuildMetadata } from './types'
import { TypescriptOptions, resolveTsConfig } from './typescript'

function logSizeStats() {
  const stats = sizeCollector.getSizeStats()
  const maxLength = Math.max(...stats.map(([filename]) => filename.length))
  stats.forEach(([filename, prettiedSize]) => {
    const padding = ' '.repeat(maxLength - filename.length)
    logger.log(` ✓  Build ${filename}${padding} - ${prettiedSize}`)
  })
}

function assignDefault(
  options: BundleConfig,
  name: keyof BundleConfig,
  defaultValue: any
) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function hasMultiEntryExport(pkg: PackageMetadata): boolean {
  const packageExportsField = pkg.exports || {}
  if (typeof packageExportsField === 'string') return false

  const exportKeys = (
    packageExportsField ? Object.keys(packageExportsField) : []
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
  const packageExportsField = pkg.exports || {}
  const isMultiEntries = hasMultiEntryExport(pkg)
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
      (await getSourcePathFromExportPath(cwd, '.')) ||
      ''
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

  // has `types` field in package.json or has `types` exports in any export condition for multi-entries
  const hasTypings =
    !!getTypings(pkg) ||
    (typeof packageExportsField === 'object' &&
      Array.from(Object.values(packageExportsField || {})).some((condition) =>
        condition.hasOwnProperty('types')
      ))

  // Enable types generation if it's types field specified in package.json
  if (hasTypings) {
    options.dts = hasTypings
  }

  let result
  if (isMultiEntries) {
    const buildConfigs = await buildEntryConfig(
      pkg,
      options,
      cwd,
      defaultTsOptions,
      false,
    )
    const assetsJobs = buildConfigs.map((rollupConfig) =>
      bundleOrWatch(rollupConfig)
    )

    const typesJobs = options.dts
      ? (
          await buildEntryConfig(pkg, options, cwd, defaultTsOptions, true)
        ).map((rollupConfig) => bundleOrWatch(rollupConfig))
      : []

    result = await Promise.all(assetsJobs.concat(typesJobs))
  } else {
    // Generate types
    if (hasTsConfig && options.dts) {
      await bundleOrWatch(
        buildConfig(entryPath, pkg, options, cwd, defaultTsOptions, true)
      )
    }

    const rollupConfig = buildConfig(entryPath, pkg, options, cwd, defaultTsOptions, false)
    result = await bundleOrWatch(rollupConfig)
  }

  logSizeStats()
  return result
}



function runWatch(
  { input, output, dtsOnly }: BuncheeRollupConfig,
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
