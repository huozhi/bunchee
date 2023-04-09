import type { RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild, RollupOutput } from 'rollup'
import type { BuncheeRollupConfig, BundleConfig, ExportCondition, PackageMetadata } from './types'

import fs from 'fs/promises'
import { resolve, join, basename, relative } from 'path'
import { watch as rollupWatch, rollup } from 'rollup'
import buildConfig from './rollup-config'
import { getPackageMeta, isTypescript, logger, formatDuration, fileExists } from './utils'
import config from './config'
import { getTypings } from './exports'
import type { BuildMetadata } from './types'

const SRC = 'src' // resolve from src/ directory

function logBuild(exportPath: string, dtsOnly: boolean, duration: number) {
  logger.log(` ✓  ${dtsOnly ? 'Typed' : 'Built'} ${exportPath} ${formatDuration(duration)}`)
}

function assignDefault(options: BundleConfig, name: keyof BundleConfig, defaultValue: any) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function resolveSourceFile(cwd: string, filename: string) {
  return resolve(cwd, SRC, filename)
}

// Map '.' -> './index.[ext]'
// Map './lite' -> './lite.[ext]'
// Return undefined if no match or if it's package.json exports
async function getSourcePathFromExportPath(cwd: string, exportPath: string): Promise<string | undefined> {
  const exts = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx']
  for (const ext of exts) {
    // ignore package.json
    if (exportPath.endsWith('package.json')) return
    if (exportPath === '.') exportPath = './index'
    const filename = resolveSourceFile(cwd, `${exportPath}.${ext}`)

    if (await fileExists(filename)) {
      return filename
    }
  }
  return
}

async function bundle(entryPath: string, { cwd, ...options }: BundleConfig = {}): Promise<any> {
  config.rootDir = resolve(process.cwd(), cwd || '')
  assignDefault(options, 'format', 'es')
  assignDefault(options, 'minify', false)
  assignDefault(options, 'target', 'es2015')

  if (options.dts === undefined && isTypescript(entryPath)) {
    options.dts = true
  }

  const pkg = await getPackageMeta(config.rootDir)
  const packageExports = pkg.exports || {}
  const isSingleEntry = typeof packageExports === 'string'
  const hasMultiEntries = packageExports && !isSingleEntry && Object.keys(packageExports).length > 0
  if (isSingleEntry) {
    // Use specified string file path if possible, then fallback to the default behavior entry picking logic
    // e.g. "exports": "./dist/index.js" -> use "./index.<ext>" as entry
    entryPath = entryPath || await getSourcePathFromExportPath(config.rootDir, '.') || ''
  }

  async function buildEntryConfig(
    packageExports: Record<string, ExportCondition>,
    dtsOnly: boolean
  ): Promise<BuncheeRollupConfig[]> {
    const configs = Object.keys(packageExports).map(async (entryExport) => {
      const source = await getSourcePathFromExportPath(config.rootDir, entryExport)
      if (!source) return undefined
      if (dtsOnly && !isTypescript(source)) return

      options.exportCondition = {
        source,
        name: entryExport,
        export: packageExports[entryExport]
      }

      const entry = resolveSourceFile(cwd!, source)
      const rollupConfig = buildConfig(entry, pkg, options, dtsOnly)
      return rollupConfig
    })

    return (await Promise.all(configs)).filter(<T>(n?: T): n is T => Boolean(n))
  }

  const bundleOrWatch = (
    rollupConfig: BuncheeRollupConfig
  ): Promise<RollupWatcher | RollupOutput[] | void> => {
    const { input, exportName } = rollupConfig
    const exportPath = getExportPath(pkg, exportName)
    // Log original entry file relative path
    const source = typeof input.input === 'string'
      ? relative(config.rootDir, input.input)
      : exportPath

    const buildMetadata: BuildMetadata = {
      source
    }
    if (options.watch) {
      return Promise.resolve(runWatch(rollupConfig, buildMetadata))
    }
    return runBundle(rollupConfig, buildMetadata)
  }

  if (!(await fileExists(entryPath))) {
    const hasSpecifiedEntryFile = entryPath === '' ? false : (await fs.stat(entryPath)).isFile()

    if (!hasSpecifiedEntryFile && !hasMultiEntries) {
      const err = new Error(`Entry file \`${entryPath}\` is not existed`)
      err.name = 'NOT_EXISTED'
      return Promise.reject(err)
    }

    // has `types` field in package.json or has `types` exports in any export condition for multi-entries
    const hasTypings =
      !!getTypings(pkg)
      || typeof packageExports === 'object' && Array.from(Object.values(packageExports || {})).some(condition => condition.hasOwnProperty('types'))

    // If there's no entry file specified, should enable dts bundling based on package.json exports info
    if (!hasSpecifiedEntryFile && hasTypings) {
      options.dts = hasTypings
    }

    if (hasMultiEntries) {
      const buildConfigs = await buildEntryConfig(packageExports, false)
      const assetsJobs = buildConfigs.map((rollupConfig) => bundleOrWatch(rollupConfig))

      const typesJobs = options.dts
        ? (await buildEntryConfig(packageExports, true)).map((rollupConfig) => bundleOrWatch(rollupConfig))
        : []

      return await Promise.all(assetsJobs.concat(typesJobs))
    }
  }

  // Generate types
  if (isTypescript(entryPath) && options.dts) {
    await bundleOrWatch(buildConfig(entryPath, pkg, options, true))
  }

  const rollupConfig = buildConfig(entryPath, pkg, options, false)
  return bundleOrWatch(rollupConfig)
}

// . -> pkg name
// ./lite -> <pkg name>/lite
function getExportPath(pkg: PackageMetadata, exportName?: string) {
  const name = pkg.name || basename(config.rootDir)
  if (exportName === '.' || !exportName) return name
  return join(name, exportName)
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

  let startTime = Date.now()
  watcher.on('event', (event) => {
    switch (event.code) {
      case 'ERROR': {
        return onError(event.error)
      }
      case 'START': {
        startTime = Date.now()
        logger.log(`Start building ${metadata.source} ...`)
        break
      }
      case 'END': {
        const duration = Date.now() - startTime
        logBuild(metadata.source, dtsOnly, duration)
        break
      }
      default: return
    }
  })
  return watcher
}

function runBundle(
  { input, output, dtsOnly }: BuncheeRollupConfig,
  jobOptions: BuildMetadata
) {
  const startTime = Date.now()

  return rollup(input)
    .then(
      (bundle: RollupBuild) => {
        const writeJobs = output.map((options: OutputOptions) => bundle.write(options))
        return Promise.all(writeJobs)
      },
      onError
    )
    .then(() => {
      const duration = Date.now() - startTime
      logBuild(jobOptions.source, dtsOnly, duration)
    })
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
