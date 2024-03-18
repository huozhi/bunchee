import type { RollupWatcher } from 'rollup'
import type { BundleConfig } from './types'
import fsp from 'fs/promises'
import fs from 'fs'
import { resolve } from 'path'
import { performance } from 'perf_hooks'
import { getReversedAlias } from './build-config'
import {
  createOutputState,
  logOutputState,
} from './plugins/output-state-plugin'
import { logger } from './logger'
import {
  getPackageMeta,
  getSourcePathFromExportPath,
  isTypescriptFile,
} from './utils'
import { getExportFileTypePath, parseExports } from './exports'
import type { BuildContext } from './types'
import {
  TypescriptOptions,
  resolveTsConfig,
  writeDefaultTsconfig,
} from './typescript'
import { collectEntriesFromParsedExports } from './entries'
import { createAssetRollupJobs, createTypesRollupJobs } from './rollup-job'

function assignDefault(
  options: BundleConfig,
  name: keyof BundleConfig,
  defaultValue: any,
) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function hasMultiEntryExport(exportPaths: object): boolean {
  const exportKeys = Object.keys(exportPaths).filter(
    (key) => key !== './package.json',
  )

  return (
    exportKeys.length > 0 && exportKeys.every((name) => name.startsWith('.'))
  )
}

async function bundle(
  cliEntryPath: string,
  { cwd: _cwd, ...options }: BundleConfig = {},
): Promise<any> {
  const cwd = resolve(process.cwd(), _cwd || '')
  assignDefault(options, 'format', 'esm')
  assignDefault(options, 'minify', false)
  assignDefault(options, 'target', 'es2015')

  const pkg = await getPackageMeta(cwd)
  const parsedExportsInfo = parseExports(pkg)
  const isMultiEntries = hasMultiEntryExport(parsedExportsInfo)
  const hasBin = Boolean(pkg.bin)
  // Original input file path, client path might change later
  const inputFile = cliEntryPath
  const isFromCli = Boolean(cliEntryPath)

  let tsConfig = resolveTsConfig(cwd, options.tsconfig)
  let hasTsConfig = Boolean(tsConfig?.tsConfigPath)
  const defaultTsOptions: TypescriptOptions = {
    tsConfigPath: tsConfig?.tsConfigPath,
    tsCompilerOptions: tsConfig?.tsCompilerOptions || {},
  }

  // Handle single entry file
  if (!isMultiEntries) {
    // Use specified string file path if possible, then fallback to the default behavior entry picking logic
    // e.g. "exports": "./dist/index.js" -> use "./index.<ext>" as entry
    cliEntryPath =
      cliEntryPath ||
      (await getSourcePathFromExportPath(cwd, '.', 'default')) ||
      ''
  }

  // Handle CLI input
  let mainExportPath: string | undefined
  let typesEntryPath: string | undefined
  if (isFromCli) {
    // with -o option
    if (options.file) {
      mainExportPath = options.file
    }

    if (mainExportPath) {
      if (options.dts) {
        typesEntryPath = getExportFileTypePath(mainExportPath)
      }

      parsedExportsInfo.set(
        '.',
        [
          [mainExportPath, 'default'],
          Boolean(typesEntryPath) && [typesEntryPath, 'types'],
        ].filter(Boolean) as [string, string][],
      )
    }
  }

  const hasSpecifiedEntryFile = cliEntryPath
    ? fs.existsSync(cliEntryPath) && (await fsp.stat(cliEntryPath)).isFile()
    : false

  const hasNoEntry = !hasSpecifiedEntryFile && !isMultiEntries && !hasBin

  if (hasNoEntry) {
    if (cliEntryPath) {
      const err = new Error(`Entry file "${cliEntryPath}" does not exist`)
      err.name = 'NOT_EXISTED'
      return Promise.reject(err)
    } else if (cwd) {
      const hasProjectDir =
        fs.existsSync(cwd) && (await fsp.stat(cwd)).isDirectory()
      if (!hasProjectDir) {
        const err = new Error(`Project directory "${cwd}" does not exist`)
        err.name = 'NOT_EXISTED'
        return Promise.reject(err)
      }
    }
  }

  const entries = await collectEntriesFromParsedExports(
    cwd,
    parsedExportsInfo,
    inputFile,
  )
  const hasTypeScriptFiles = Object.values(entries).some((entry) =>
    isTypescriptFile(entry.source),
  )
  if (hasTypeScriptFiles && !hasTsConfig) {
    const tsConfigPath = resolve(cwd, 'tsconfig.json')
    defaultTsOptions.tsConfigPath = tsConfigPath
    await writeDefaultTsconfig(tsConfigPath)
    hasTsConfig = true
  }

  const sizeCollector = createOutputState({ entries })
  const entriesAlias = getReversedAlias({ entries, name: pkg.name })
  const buildContext: BuildContext = {
    entries,
    pkg,
    cwd,
    tsOptions: defaultTsOptions,
    useTypeScript: hasTsConfig,
    pluginContext: {
      outputState: sizeCollector,
      moduleDirectiveLayerMap: new Map(),
      entriesAlias,
    },
  }

  const generateTypes = hasTsConfig && options.dts !== false
  const rollupJobsOptions = { isFromCli, generateTypes }

  const assetJobs = await createAssetRollupJobs(
    options,
    buildContext,
    rollupJobsOptions,
  )

  if (assetJobs.length === 0) {
    logger.warn(
      'The "src" directory does not contain any entry files. ' +
        'For proper usage, please refer to the following link: ' +
        'https://github.com/huozhi/bunchee#usage',
    )
  }

  if (options.watch) {
    logWatcherBuildTime(assetJobs as RollupWatcher[])
  } else {
    logOutputState(sizeCollector)
  }

  return
}

function logWatcherBuildTime(result: RollupWatcher[]) {
  let watcherCounter = 0
  let startTime = 0

  result.map((watcher) => {
    function start() {
      if (watcherCounter === 0) startTime = performance.now()
      watcherCounter++
    }
    function end() {
      watcherCounter--
      if (watcherCounter === 0) {
        logger.info(`Build in ${(performance.now() - startTime).toFixed(2)}ms`)
      }
    }
    ;(watcher as RollupWatcher).on('event', (event) => {
      switch (event.code) {
        case 'ERROR': {
          logError(event.error)
          break
        }
        case 'START': {
          start()
          break
        }
        case 'END': {
          end()
          break
        }
        default:
          break
      }
    })
  })
}

function logError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stderr.write(error.frame + '\n')
  }
}

export default bundle
