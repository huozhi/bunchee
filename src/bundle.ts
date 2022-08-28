import type { RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild } from 'rollup'
import type { BuncheeRollupConfig, CliArgs } from './types'

import fs from 'fs'
import { resolve } from 'path'
import { watch as rollupWatch, rollup } from 'rollup'
import createRollupConfig from './rollup-config'
import { getPackageMeta } from './utils'
import config from './config'

function assignDefault(options: CliArgs, name: keyof CliArgs, defaultValue: any) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

// Map '.' -> './index.[ext]'
// Map './lite' -> './lite.[ext]'
function getSourcePathFromExportPath(cwd: string, exportPath: string) {
  const exts = ['js', 'cjs', 'mjs', 'jsx', 'ts', 'tsx']
  for (const ext of exts) {
    // ignore package.json
    if (exportPath.endsWith('package.json')) return
    if (exportPath === '.') exportPath = './index'
    const filename = resolve(cwd, `${exportPath}.${ext}`)
    if (fs.existsSync(filename)) return filename
  }
  return
}

function bundle(entryPath: string, { cwd, ...options }: CliArgs = {}): Promise<any> {
  config.rootDir = resolve(process.cwd(), cwd || '')
  assignDefault(options, 'format', 'es')

  // alias for 'es' in rollup
  if (options.format === 'esm') {
    options.format = 'es'
  }

  const npmPackage = getPackageMeta()
  const { exports: packageExports } = npmPackage
  const isSingleEntry = typeof packageExports === 'string'
  const hasMultiEntries = packageExports && !isSingleEntry && Object.keys(packageExports).length > 0

  if (isSingleEntry) {
    entryPath = getSourcePathFromExportPath(config.rootDir, '.') as string
  }

  if (!fs.existsSync(entryPath)) {
    const hasEntryFile = entryPath === '' ? '' : fs.statSync(entryPath).isFile()

    if (!hasEntryFile && !hasMultiEntries) {
      const err = new Error('Entry file is not existed')
      err.name = 'NOT_EXISTED'
      return Promise.reject(err)
    }

    if (hasMultiEntries) {
      const rollupConfigs = Object.keys(packageExports).map((entryExport) => {
        const source = getSourcePathFromExportPath(config.rootDir, entryExport)
        if (!source) return

        options.exportCondition = {
          source,
          export: packageExports[entryExport]
        }

        const rollupConfig = createRollupConfig(resolve(cwd!, source), npmPackage, options)
        return rollupConfig
      })

      return Promise.all(rollupConfigs.filter(Boolean).map((rollupConfig) => runBundle(rollupConfig!)))
    }
  }

  const rollupConfig = createRollupConfig(entryPath, npmPackage, options)

  if (options.watch) {
    return Promise.resolve(runWatch(rollupConfig))
  }
  return runBundle(rollupConfig)
}

function runWatch({ input, output }: BuncheeRollupConfig): RollupWatcher {
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
    if (event.code === 'ERROR') {
      onError(event.error)
    }
  })
  return watcher
}

function runBundle({ input, output }: BuncheeRollupConfig) {
  return rollup(input).then((bundle: RollupBuild) => {
    const writeJobs = output.map((options: OutputOptions) => bundle.write(options))
    return Promise.all(writeJobs)
  }, onError)
}

function onError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stdout.write(error.frame + '\n')
  }
  if (error.stack) {
    process.stdout.write(error.stack + '\n')
  }
  throw error
}

export default bundle
