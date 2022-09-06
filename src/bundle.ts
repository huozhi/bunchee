import type { RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild, RollupOutput } from 'rollup'
import type { BuncheeRollupConfig, CliArgs, PackageMetadata } from './types'

import fs from 'fs'
import { resolve, join, basename, extname } from 'path'
import { watch as rollupWatch, rollup } from 'rollup'
import buildConfig from './rollup-config'
import { getPackageMeta, isTypescript, logger } from './utils'
import config from './config'

function assignDefault(options: CliArgs, name: keyof CliArgs, defaultValue: any) {
  if (!(name in options) || options[name] == null) {
    (options[name] as CliArgs[keyof CliArgs]) = defaultValue
  }
}

// Map '.' -> './index.[ext]'
// Map './lite' -> './lite.[ext]'
function getSourcePathFromExportPath(cwd: string, exportPath: string): string | undefined {
  const exts = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx']
  for (const ext of exts) {
    // ignore package.json
    if (exportPath.endsWith('package.json')) return undefined
    if (exportPath === '.') exportPath = './index'
    const filename = resolve(cwd, `${exportPath}.${ext}`)

    if (fs.existsSync(filename)) {
      return filename
    }
  }
}

async function bundle(entryPath: string, { cwd, ...options }: CliArgs = {}): Promise<any> {
  config.rootDir = resolve(process.cwd(), cwd || '')
  assignDefault(options, 'format', 'es')
  assignDefault(options, 'minify', false)
  assignDefault(options, 'target', 'es5')

  // alias for 'es' in rollup
  if (options.format === 'esm') {
    options.format = 'es'
  }

  const pkg = getPackageMeta()
  const { exports: packageExports } = pkg
  const isSingleEntry = typeof packageExports === 'string'
  const hasMultiEntries = packageExports && !isSingleEntry && Object.keys(packageExports).length > 0
  if (isSingleEntry) {
    entryPath = getSourcePathFromExportPath(config.rootDir, '.') as string
  }

  function buildEntryConfig(dtsOnly: boolean) {
    const configs = Object.keys(packageExports).map((entryExport) => {
      const source = getSourcePathFromExportPath(config.rootDir, entryExport)
      if (!source) return undefined
      if (dtsOnly && !isTypescript(source)) return

      options.exportCondition = {
        source,
        name: entryExport,
        export: packageExports[entryExport]
      }

      const entry = resolve(cwd!, source)
      const rollupConfig = buildConfig(entry, pkg, options, dtsOnly)
      return rollupConfig
    }).filter(v => !!v)

    return configs
  }

  const bundleOrWatch = (
    rollupConfig: BuncheeRollupConfig
  ): Promise<RollupWatcher | RollupOutput[] | void> => {
    if (options.watch) {
      return Promise.resolve(runWatch(pkg, rollupConfig))
    }
    return runBundle(pkg, rollupConfig)
  }

  if (!fs.existsSync(entryPath)) {
    const hasEntryFile = entryPath === '' ? '' : fs.statSync(entryPath).isFile()

    if (!hasEntryFile && !hasMultiEntries) {
      const err = new Error('Entry file is not existed')
      err.name = 'NOT_EXISTED'
      return Promise.reject(err)
    }

    if (hasMultiEntries) {
      const assetsJobs = buildEntryConfig(false).map((rollupConfig) => bundleOrWatch(rollupConfig!))
      const typesJobs = buildEntryConfig(true).map((rollupConfig) => bundleOrWatch(rollupConfig!))

      return await Promise.all(assetsJobs.concat(typesJobs))
    }
  }

  // Generate types
  if (isTypescript(entryPath)) {
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

function runWatch(pkg: PackageMetadata, { exportName, input, output }: BuncheeRollupConfig): RollupWatcher {
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
  const exportPath = getExportPath(pkg, exportName)
  let startTime = Date.now()
  watcher.on('event', (event) => {
    switch (event.code) {
      case 'ERROR': {
        return onError(event.error)
      }
      case 'START': {
        startTime = Date.now()
        logger.log(`Start building ${exportPath} ...`)
      }
      case 'END': {
        const duration = Date.now() - startTime
        if (duration > 0) {
          logger.log(`✨ Built ${exportPath}`)
        }
      }
      default: return
    }
  })
  return watcher
}

function runBundle(pkg: PackageMetadata, { exportName, input, output }: BuncheeRollupConfig) {
  let startTime = Date.now()
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
      if (duration > 0) {
        logger.log(`✨ Built ${getExportPath(pkg, exportName)}`)
      }
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
