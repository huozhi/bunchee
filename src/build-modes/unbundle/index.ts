import fs from 'fs'
import { dirname, resolve, sep } from 'path'
import { SRC } from '../../constants'
import type { BundleConfig, Entries } from '../../types'
import type { BuildMode } from '../types'
import { bundledMode } from '../bundled'
import { isTypescriptFile } from '../../utils'
import { getExportFileTypePath } from '../../exports'
import { commonRootDir } from '../../lib/common-root'
import { logger } from '../../logger'
import {
  claimUnbundleOutput,
  createUnbundleFileNames,
  getConditionSuffix,
  unbundleError,
} from './paths'
import { unbundleOutputGuard } from './output-guard'
import { createUnbundleModuleTracker } from './modules-plugin'
import { unbundledNativeAddon } from './native-addon'
import { createUnbundleOutputState } from './output-state'

/** All unbundle policy and per-build state live behind this adapter. */
export function createUnbundleMode(options: BundleConfig): BuildMode {
  if (options.watch)
    throw unbundleError(
      'BUNCHEE_UNBUNDLE_WATCH_UNSUPPORTED',
      'Unbundle does not support watch mode yet. Remove --watch or --unbundle.',
    )
  if (options.file)
    throw unbundleError(
      'BUNCHEE_UNBUNDLE_SINGLE_OUTPUT',
      'Unbundle needs package.json exports to define output paths. Remove -o/--output.',
    )

  const registry = new Map<string, string>()
  const modulePlugin = createUnbundleModuleTracker()
  // Build-wide roots. Every graph maps a module to the same path, so a graph
  // whose entries all live in a subdirectory (a `react-server` subpath, say)
  // still places shared modules where the default graph does.
  let rootDir: string | undefined
  let srcRoot: string | undefined
  /** Output extension -> deepest directory holding every entry file with it. */
  const outRoots = new Map<string, string>()
  const outputExtension = (file: string) =>
    /\.d\.[cm]?ts$|\.[cm]?js$/.exec(file)?.[0] ?? ''
  const computeRoots = (entries: Entries) => {
    const cwd = rootDir ?? process.cwd()
    const sources = Object.values(entries).map((entry) => entry.source)
    // Like tsc's rootDir: mirror `src/` whenever every entry lives in it, so
    // a module's path does not depend on which entries happen to exist.
    const conventional = resolve(cwd, SRC)
    srcRoot = commonRootDir([
      ...sources.map((source) => dirname(source)),
      ...(sources.every((source) => source.startsWith(conventional + sep))
        ? [conventional]
        : []),
    ])
    const dirsByExt = new Map<string, string[]>()
    for (const entry of Object.values(entries))
      for (const target of entry.targets) {
        const ext = outputExtension(target.path)
        if (!ext) continue
        const dirs = dirsByExt.get(ext) ?? []
        dirs.push(dirname(resolve(cwd, target.path)))
        dirsByExt.set(ext, dirs)
      }
    outRoots.clear()
    for (const [ext, dirs] of dirsByExt) outRoots.set(ext, commonRootDir(dirs))
  }
  return {
    forceMerged: true,
    // Shards would concurrently emit the same internal modules.
    allowWorkers: false,
    resolveInput(cwd, entry) {
      rootDir = fs.existsSync(cwd) ? fs.realpathSync(cwd) : cwd
      return {
        cwd: rootDir,
        entry: entry && fs.existsSync(entry) ? fs.realpathSync(entry) : entry,
      }
    },
    validatePackage(pkg) {
      if (!pkg.exports && !pkg.bin)
        throw unbundleError(
          'BUNCHEE_UNBUNDLE_NO_EXPORTS',
          'Unbundle requires package.json exports or bin entries. Define them instead of relying on main/module or an inferred CLI output.',
        )
    },
    prepareEntries(exports) {
      const keys = new Set(exports.keys())
      const targets = new Set(
        [...exports.values()].flatMap((items) =>
          items.map((target) => target.path),
        ),
      )
      return (entries) => {
        for (const [name, entry] of Object.entries(entries)) {
          if (!entry.targets.some((target) => targets.has(target.path)))
            delete entries[name]
        }
        // Discovery adds synthetic private exports for bundled builds. They
        // become ordinary reachable modules here, not public entrypoints.
        for (const key of exports.keys())
          if (!keys.has(key)) exports.delete(key)
        if (!Object.keys(entries).length)
          throw unbundleError(
            'BUNCHEE_UNBUNDLE_NO_ENTRIES',
            'No unbundle entries found. Define package.json exports and matching source files.',
          )
      }
    },
    prepareTypes(entries, generateTypes) {
      // Runs after entry filtering and declaration targets, so the roots see
      // every public file this build writes.
      if (generateTypes) addDeclarationTargets(entries)
      computeRoots(entries)
    },
    createOutputState: createUnbundleOutputState,
    graphShape: (env, entry, target) => [
      ...bundledMode.graphShape(env, { ...entry, targets: [target] }, target),
      getConditionSuffix(target),
    ],
    oneOutputPerSource: true,
    declarationTarget: (target, path) => ({ ...target, path }),
    // Preserved declaration files keep their imports, so the DTS plugin must
    // resolve tsconfig `paths` aliases (`@utils/x`) to rewrite them into
    // relative specifiers. With an auto-discovered tsconfig the plugin is not
    // handed the file, so pass the resolved options through explicitly.
    declarationOptions: (compilerOptions) => compilerOptions,
    inputPlugins(context, dts, inputs, target) {
      return [
        modulePlugin({
          inputs,
          suffix: getConditionSuffix(target),
          dts,
          entrySources: new Set(
            Object.values(context.entries).map((entry) => entry.source),
          ),
          allowJs: Boolean(context.tsOptions.tsCompilerOptions?.allowJs),
        }),
        unbundleOutputGuard(registry),
      ]
    },
    nativeAddonPlugin: unbundledNativeAddon,
    configureOutput(output, _sources, files, target) {
      const ext = outputExtension(target.path)
      const dir = commonRootDir([
        outRoots.get(ext) ?? output.dir!,
        ...[...files.values()].map(dirname),
      ])
      for (const [source, file] of files)
        claimUnbundleOutput(registry, file, source, dir)
      const preserved = {
        ...output,
        dir,
        preserveModules: true,
        entryFileNames: createUnbundleFileNames({
          dir,
          srcRoot: srcRoot!,
          rootDir,
          outputFilesBySource: files,
          ext,
          suffix: getConditionSuffix(target),
          registry,
        }),
      }
      delete preserved.manualChunks
      delete preserved.chunkFileNames
      return preserved
    },
    finish({ pkg }) {
      // A hint, not a problem: without the field, consumers simply treat every
      // module as side-effectful, which is safe.
      if (pkg.sideEffects === undefined)
        logger.info(
          'Unbundle output keeps individual modules. Consider setting "sideEffects": false or listing side-effectful files (for example CSS) in package.json.',
        )
    },
  }
}

/** Give every TypeScript entry a declaration target per JS output. */
function addDeclarationTargets(entries: Entries): void {
  for (const entry of Object.values(entries)) {
    if (!isTypescriptFile(entry.source)) continue
    const types = entry.targets.filter((target) =>
      /\.d\.[cm]?ts$/.test(target.path),
    )
    for (const target of [...entry.targets]) {
      if (/\.d\.[cm]?ts$/.test(target.path)) continue
      const path = getExportFileTypePath(target.path)
      const extension = /\.d\.[cm]?ts$/.exec(path)![0]
      if (
        !types.some(
          (type) =>
            type.path.endsWith(extension) &&
            getConditionSuffix(type) === getConditionSuffix(target),
        )
      )
        entry.targets.push({
          path,
          conditions: [...target.conditions, 'types'],
        })
    }
  }
}
