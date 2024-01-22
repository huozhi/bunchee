import type {
  RollupWatcher,
  RollupWatchOptions,
  OutputOptions,
  RollupBuild,
  RollupOutput,
} from 'rollup'
import type { BuncheeRollupConfig, BundleConfig, ExportPaths } from './types'
import { watch as rollupWatch, rollup } from 'rollup'
import fsp from 'fs/promises'
import fs from 'fs'
import { resolve } from 'path'
import pc from 'picocolors'
import {
  buildEntryConfig,
  collectEntries,
  getReversedAlias,
} from './build-config'
import {
  createOutputState,
  logOutputState,
} from './plugins/output-state-plugin'
import { logger } from './logger'
import {
  getPackageMeta,
  getSourcePathFromExportPath,
  removeDir,
  isTypescriptFile,
} from './utils'
import {
  constructDefaultExportCondition,
  getExportFileTypePath,
  getExportPaths,
  getPackageType,
} from './exports'
import type { BuildContext } from './types'
import { TypescriptOptions, resolveTsConfig } from './typescript'
import { resolveWildcardExports } from './lib/wildcard'
import { DEFAULT_TS_CONFIG } from './constants'

function assignDefault(
  options: BundleConfig,
  name: keyof BundleConfig,
  defaultValue: any,
) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function hasMultiEntryExport(exportPaths: ExportPaths): boolean {
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
  const resolvedWildcardExports = await resolveWildcardExports(pkg.exports, cwd)
  const packageType = getPackageType(pkg)

  const exportPaths = getExportPaths(pkg, resolvedWildcardExports)
  const isMultiEntries = hasMultiEntryExport(exportPaths) // exportPathsLength > 1
  const hasBin = Boolean(pkg.bin)
  const isFromCli = Boolean(cliEntryPath)

  let tsConfig = await resolveTsConfig(cwd)
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
  if (cliEntryPath) {
    let mainEntryPath: string | undefined
    let typesEntryPath: string | undefined
    // with -o option
    if (options.file) {
      mainEntryPath = options.file
    }

    if (mainEntryPath) {
      if (options.dts) {
        typesEntryPath = getExportFileTypePath(mainEntryPath)
      }

      exportPaths['.'] = constructDefaultExportCondition(
        {
          main: mainEntryPath,
          types: typesEntryPath,
        },
        packageType,
      )
    }
  }

  const bundleOrWatch = async (
    rollupConfig: BuncheeRollupConfig,
  ): Promise<RollupWatcher | RollupOutput | void> => {
    if (options.clean) {
      if (!isFromCli) {
        await removeOutputDir(rollupConfig.output)
      }
    }

    if (options.watch) {
      return Promise.resolve(runWatch(rollupConfig))
    }
    return runBundle(rollupConfig)
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

  const entries = await collectEntries(pkg, cliEntryPath, exportPaths, cwd)
  console.log('entries', entries)
  const hasTypeScriptFiles = Object.values(entries).some((entry) =>
    isTypescriptFile(entry.source),
  )
  if (hasTypeScriptFiles && !hasTsConfig) {
    const tsConfigPath = resolve(cwd, 'tsconfig.json')
    defaultTsOptions.tsConfigPath = tsConfigPath
    await fsp.writeFile(
      tsConfigPath,
      JSON.stringify(DEFAULT_TS_CONFIG, null, 2),
      'utf-8',
    )
    logger.log(
      `Detected using TypeScript but tsconfig.json is missing, created a ${pc.blue(
        'tsconfig.json',
      )} for you.`,
    )
    hasTsConfig = true
  }

  const sizeCollector = createOutputState({ entries })
  const entriesAlias = getReversedAlias(entries)
  const buildContext: BuildContext = {
    entries,
    pkg,
    exportPaths,
    cwd,
    tsOptions: defaultTsOptions,
    useTypeScript: hasTsConfig,
    pluginContext: {
      outputState: sizeCollector,
      moduleDirectiveLayerMap: new Map(),
      entriesAlias,
    },
  }
  const buildConfigs = await buildEntryConfig(options, buildContext, false)
  const assetsJobs = buildConfigs.map((rollupConfig) =>
    bundleOrWatch(rollupConfig),
  )

  const typesJobs = hasTsConfig
    ? (await buildEntryConfig(options, buildContext, true)).map(
        (rollupConfig) => bundleOrWatch(rollupConfig),
      )
    : []

  const result = await Promise.all(assetsJobs.concat(typesJobs))

  if (result.length === 0) {
    logger.warn(
      'The "src" directory does not contain any entry files. ' +
        'For proper usage, please refer to the following link: ' +
        'https://github.com/huozhi/bunchee#usage',
    )
  }

  if (!options.watch) {
    logOutputState(sizeCollector)
  }
  return result
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
    switch (event.code) {
      case 'ERROR': {
        logError(event.error)
        break
      }
      case 'START': {
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

async function removeOutputDir(output: OutputOptions) {
  if (output.dir) await removeDir(output.dir)
}

function runBundle({ input, output }: BuncheeRollupConfig) {
  return rollup(input).then((bundle: RollupBuild) => {
    return bundle.write(output)
  }, catchErrorHandler)
}

function logError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stderr.write(error.frame + '\n')
  }
}

function catchErrorHandler(error: any) {
  if (!error) return
  logError(error)
  // filter out the rollup plugin error information such as loc/frame/code...
  const err = new Error(error.message)
  err.stack = error.stack
  throw err
}

export default bundle
