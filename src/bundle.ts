import type {
  BrowserslistConfig,
  BundleConfig,
  BundleJobOptions,
} from './types'
import fsp from 'fs/promises'
import fs from 'fs'
import { dirname, resolve } from 'path'
import {
  fileExists,
  getPackageMeta,
  getSourcePathFromExportPath,
  isBinExportPath,
  isTypescriptFile,
} from './utils'
import {
  MIN_ENTRIES_FOR_MERGED_WORKERS,
  availableCores,
  runEntriesInWorkers,
} from './lib/worker-pool'
import {
  getExportFileTypePath,
  parseExports,
  type ParsedExportsInfo,
} from './exports'
import type { BuildContext } from './types'
import {
  TypescriptOptions,
  resolveTsConfig,
  resolveTsConfigPath,
  writeDefaultTsconfig,
} from './typescript'
import { collectEntriesFromParsedExports } from './entries'
import { createMergedRollupJobs } from './rollup-job'
import { shardEntries, typeShardCount } from './rollup/merged-config'
import { spawn } from 'child_process'
import { isStatsMode, warnWithCode } from './logger'
import { endProfile, startProfile } from './lib/profile'
import { createBuildMode } from './build-modes'
import { createOutputCleaner } from './lib/output-cleaner'

function assignDefault(
  options: BundleConfig,
  name: keyof BundleConfig,
  defaultValue: any,
) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function hasMultiEntryExport(parsedExportsInfo: ParsedExportsInfo): boolean {
  const exportKeys = [...parsedExportsInfo.keys()].filter(
    (key) => key !== './package.json' && !isBinExportPath(key),
  )

  return (
    exportKeys.length > 0 && exportKeys.every((name) => name.startsWith('.'))
  )
}

async function bundle(
  cliEntryPath: string,
  { cwd: _cwd, onSuccess, ...options }: BundleConfig = {},
): Promise<void> {
  const bundleStarted = startProfile()
  const mode = createBuildMode(options)
  const resolvedInput = mode.resolveInput(
    resolve(process.cwd(), _cwd || ''),
    cliEntryPath,
  )
  const cwd = resolvedInput.cwd
  cliEntryPath = resolvedInput.entry
  assignDefault(options, 'format', 'esm')
  assignDefault(options, 'minify', false)
  assignDefault(options, 'target', 'es2022')

  const packageStarted = startProfile()
  const pkg = await getPackageMeta(cwd)
  mode.validatePackage(pkg)
  const parsedExportsInfo = await parseExports(pkg, cwd)
  endProfile('bundle.package', packageStarted, {
    exports: parsedExportsInfo.size,
  })
  const isMultiEntries = hasMultiEntryExport(parsedExportsInfo)
  const hasBin = Boolean(pkg.bin)
  // Original input file path, client path might change later
  const inputFile = cliEntryPath
  const isFromCli = Boolean(cliEntryPath)

  const tsconfigStarted = startProfile()
  const tsConfigPath = resolveTsConfigPath(cwd, options.tsconfig)
  let tsConfig = resolveTsConfig(cwd, tsConfigPath)
  endProfile('bundle.tsconfig', tsconfigStarted, {
    found: Boolean(tsConfig?.tsConfigPath),
  })
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

      parsedExportsInfo.set('./index', [
        { path: mainExportPath, conditions: ['default'] },
        ...(typesEntryPath
          ? [{ path: typesEntryPath, conditions: ['types'] }]
          : []),
      ])
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

  const entriesStarted = startProfile()
  const entries = mode.selectEntries(
    await collectEntriesFromParsedExports(
      cwd,
      parsedExportsInfo,
      pkg,
      inputFile,
    ),
    parsedExportsInfo,
  )
  endProfile('bundle.entries', entriesStarted, {
    entries: Object.keys(entries).length,
  })

  // Collect and log missing entries for defined exports
  const missingEntries = [...parsedExportsInfo.keys()].filter(
    (key) => !entries[key] && key !== './package.json',
  )
  if (missingEntries.length > 0 && !options._entryFilter) {
    warnWithCode(
      'EXPORT_MISSING_SOURCE',
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

  const outputState = mode.createOutputState(entries)

  const buildContext: BuildContext = {
    mode,
    cleanOutputDir: createOutputCleaner(cwd),
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

  const entryNames = Object.keys(entries)

  // Every build goes through a few shared rollup instances, one module graph
  // per group of entries, so shared code becomes a chunk instead of being
  // copied into each entry that uses it. Only declaration emit is split
  // across workers, and only for very large packages: it does not pay for the
  // pool below `MIN_ENTRIES_FOR_MERGED_WORKERS` entries, where it cost more
  // than it saved on every package measured. A worker builds a shard of
  // entries as one graph, with the entries it does not own resolved as
  // externals against their own output paths.
  const useWorkers =
    mode.allowWorkers &&
    generateTypes &&
    !options.watch &&
    !options._entryFilter &&
    // --stats: workers write to the shared stdout directly, which must only
    // carry the stats JSON, and their warnings would not be collected.
    !isStatsMode() &&
    // Test-only, not supported options: the tests build the same package
    // both ways and diff the output, and fixtures are far below the threshold.
    !process.env.TEST_NO_WORKERS &&
    (entryNames.length >= MIN_ENTRIES_FOR_MERGED_WORKERS ||
      Boolean(process.env.TEST_WORKERS))

  try {
    let assetJobs
    if (useWorkers) {
      // Clean once before fanning out; concurrent workers must not remove
      // each other's output. Every output directory the rollup configs would
      // clean is covered: the export conditions hold the js dist files, plus
      // the `types` condition when it is declared, and the types path derived
      // from a js path when it is not always lands in the same directory.
      if (options.clean && !isFromCli) {
        for (const entry of Object.values(entries)) {
          for (const target of entry.targets) {
            await buildContext.cleanOutputDir({
              dir: dirname(resolve(cwd, target.path)),
            })
          }
        }
      }
      // The JS side first, so the workers are not competing with it and so
      // everything is written after the clean above.
      const mergedJobs = await createMergedRollupJobs(options, buildContext, {
        ...rollupJobsOptions,
        generateTypes: false,
      })
      const workerStats = await runEntriesInWorkers(
        cwd,
        // The original CLI entry, before the single-entry fallback above
        // reassigns it — this is what the entries above were resolved with.
        inputFile,
        shardEntries(
          entryNames,
          typeShardCount(entryNames.length, availableCores()),
        ),
        // With the JS assets already built, the workers only owe the types.
        { ...options, _typesOnly: true },
      )
      for (const stats of workerStats) {
        outputState.mergeSizeStats(stats)
      }
      assetJobs = [...mergedJobs, ...workerStats]
    } else {
      assetJobs = await createMergedRollupJobs(
        options,
        buildContext,
        rollupJobsOptions,
      )
    }

    options._callbacks?.onBuildEnd?.(assetJobs)
    mode.finish(buildContext)

    // Finished building successfully
    if (onSuccess) {
      if (typeof onSuccess === 'string') {
        const successProg = spawn(onSuccess, {
          shell: true,
          // --stats keeps stdout for the JSON: send the command's stdout to stderr.
          stdio: isStatsMode() ? ['inherit', 2, 'inherit'] : 'inherit',
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
    endProfile('bundle.total', bundleStarted, {
      entries: entryNames.length,
      generateTypes,
      jobs: assetJobs.length,
      status: 'success',
    })
  } catch (error) {
    endProfile('bundle.total', bundleStarted, {
      entries: entryNames.length,
      generateTypes,
      status: 'error',
    })
    options._callbacks?.onBuildError?.(error)
    return Promise.reject(error)
  }
}

export default bundle
