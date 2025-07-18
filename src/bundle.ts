import type {
  BrowserslistConfig,
  BundleConfig,
  BundleJobOptions,
} from './types'
import fsp from 'fs/promises'
import fs from 'fs'
import { resolve } from 'path'
import { createOutputState } from './plugins/output-state-plugin'
import {
  fileExists,
  getPackageMeta,
  getSourcePathFromExportPath,
  isTypescriptFile,
} from './utils'
import { getExportFileTypePath, parseExports } from './exports'
import type { BuildContext } from './types'
import {
  TypescriptOptions,
  resolveTsConfig,
  resolveTsConfigPath,
  writeDefaultTsconfig,
} from './typescript'
import { collectEntriesFromParsedExports } from './entries'
import { createAssetAndTypeJobs } from './rollup-job'
import { spawn } from 'child_process'
import { logger } from './logger'

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
  { cwd: _cwd, onSuccess, ...options }: BundleConfig = {},
): Promise<void> {
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

  const tsConfigPath = resolveTsConfigPath(cwd, options.tsconfig)
  let tsConfig = resolveTsConfig(cwd, tsConfigPath)
  let hasTsConfig = Boolean(tsConfig?.tsConfigPath)

  const defaultTsOptions: TypescriptOptions = {
    tsConfigPath: tsConfig?.tsConfigPath,
    tsCompilerOptions: tsConfig?.tsCompilerOptions,
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
      if (options.dts !== false) {
        typesEntryPath = getExportFileTypePath(mainExportPath)
      }

      parsedExportsInfo.set(
        './index',
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
    } else {
      // Check if the project directory exists
      const hasProjectDir =
        cwd && fs.existsSync(cwd) && (await fsp.stat(cwd)).isDirectory()
      // Error if the project directory does not exist
      if (cwd && !hasProjectDir) {
        const err = new Error(`Project directory "${cwd}" does not exist`)
        err.name = 'NOT_EXISTED'
        return Promise.reject(err)
      }
    }
  }

  const entries = await collectEntriesFromParsedExports(
    cwd,
    parsedExportsInfo,
    pkg,
    inputFile,
  )

  // Collect and log missing entries for defined exports
  const missingEntries = [...parsedExportsInfo.keys()].filter(
    (key) => !entries[key] && key !== './package.json',
  )
  if (missingEntries.length > 0) {
    logger.warn(
      `The following exports are defined in package.json but missing source files:\n${missingEntries
        .map((name) => `⨯ ${name}`)
        .join('\n')}\n`,
    )
  }

  const hasTypeScriptFiles = Object.values(entries).some((entry) =>
    isTypescriptFile(entry.source),
  )
  // If there's no tsconfig, create one.
  if (hasTypeScriptFiles && !hasTsConfig) {
    // Check if tsconfig.json exists in the project first.
    // If not, create one with default settings.
    // Otherwise, use the existing one.
    const defaultTsConfigPath = resolve(cwd, 'tsconfig.json')
    if (!fileExists(defaultTsConfigPath)) {
      await writeDefaultTsconfig(defaultTsConfigPath)
    }
    defaultTsOptions.tsConfigPath = defaultTsConfigPath
    hasTsConfig = true
  }

  let browserslistConfig: BrowserslistConfig | undefined
  if (options.runtime === 'browser') {
    browserslistConfig = pkg.browserslist
  }

  const outputState = createOutputState({ entries })
  const buildContext: BuildContext = {
    entries,
    pkg,
    cwd,
    tsOptions: defaultTsOptions,
    useTypeScript: hasTsConfig,
    browserslistConfig,
    pluginContext: {
      outputState,
      moduleDirectiveLayerMap: new Map(),
    },
  }

  options._callbacks?.onBuildStart?.(buildContext)

  const generateTypes = hasTsConfig && options.dts !== false
  const rollupJobsOptions: BundleJobOptions = { isFromCli, generateTypes }

  try {
    const assetJobs = await createAssetAndTypeJobs(
      options,
      buildContext,
      rollupJobsOptions,
    )

    options._callbacks?.onBuildEnd?.(assetJobs)

    // Finished building successfully
    if (onSuccess) {
      if (typeof onSuccess === 'string') {
        const successProg = spawn(onSuccess, {
          shell: true,
          stdio: 'inherit',
          cwd,
        })
        successProg.on('exit', (code) => {
          if (code) {
            process.exitCode = code
          }
        })
      } else {
        await onSuccess()
      }
    }
  } catch (error) {
    options._callbacks?.onBuildError?.(error)
    return Promise.reject(error)
  }
}

export default bundle
