import { dirname, relative, resolve, sep } from 'path'
import { readFile } from 'fs/promises'
import { glob } from 'tinyglobby'
import type {
  BuildContext,
  BundleConfig,
  Entries,
  MergedRollupConfig,
  ParsedExportCondition,
  bundleEntryOptions,
} from '../types'
import type { ExportOutput } from '../exports'
import { buildInputConfig } from './input'
import { buildOutputConfigs } from './output'
import { getEntryBundleOutputs } from '../build-config'
import { isBinExportPath, normalizePath } from '../utils'
import {
  availableExtensions,
  specialExportConventions,
  TESTS_GLOB_PATTERN,
} from '../constants'
import { getDefinedInlineVariables } from '../env'
import { logger } from '../logger'

type GroupItem = {
  exportPath: string
  exportCondition: ParsedExportCondition
  output: ExportOutput
}

type Group = {
  /** Debug label; also the map key that collects the group. */
  key: string
  items: GroupItem[]
}

const BOUNDARY_DIRECTIVE_REGEX =
  /^\s*(?:\/\*[\s\S]*?\*\/|\/\/.*\n)*\s*['"]use (client|server)['"]/

/**
 * Whether the package uses `'use client'` / `'use server'` boundaries.
 *
 * A per-entry build decides where a directive module lands separately for each
 * entry, so the same module can be inlined into one output and split into its
 * own chunk in another. One shared graph only gets to make that call once, so
 * merging cannot reproduce the existing chunk layout for these packages —
 * see `test/integration/server-components`. Detect it and stay on the
 * per-entry path.
 *
 * Conservative on purpose: a false positive only means the build keeps working
 * the way it does today.
 */
async function hasBoundaryDirectives(entries: Entries): Promise<boolean> {
  const sourceDirs = new Set(
    Object.values(entries).map((entry) => dirname(entry.source)),
  )
  const extensions = [...availableExtensions].join(',')
  const files = new Set<string>()
  for (const dir of sourceDirs) {
    const found = await glob(`**/*.{${extensions}}`, {
      cwd: dir,
      absolute: true,
      ignore: [TESTS_GLOB_PATTERN, '**/node_modules/**'],
    })
    for (const file of found) files.add(file)
  }

  for (const file of files) {
    // Directives are the first statement, so only the head matters.
    const handle = await readFile(file, 'utf8').catch(() => '')
    if (BOUNDARY_DIRECTIVE_REGEX.test(handle.slice(0, 512))) {
      return true
    }
  }
  return false
}

/**
 * Whether every entry can share one module graph.
 *
 * This merges all-or-nothing. Partial merging is possible but a standalone
 * entry importing a merged one has to go back through the alias plugin for its
 * `<pkg>/<subpath>` rewrite, and that interaction wants designing on its own.
 */
export async function canMergeEntries(
  entries: Entries,
  bundleConfig: BundleConfig,
  isFromCli: boolean,
): Promise<boolean> {
  const reason = await findMergeBlocker(entries, bundleConfig, isFromCli)
  if (reason && process.env.DEBUG) {
    logger.log(`Not merging entries into shared rollup instances: ${reason}`)
  }
  return reason == null
}

/** Why this package cannot be merged, or `undefined` if it can. */
async function findMergeBlocker(
  entries: Entries,
  bundleConfig: BundleConfig,
  isFromCli: boolean,
): Promise<string | undefined> {
  // A CLI `-o` build has a single explicit output; nothing to merge.
  if (isFromCli || bundleConfig.file) return 'building a single CLI output'
  // Watch mode drives one rollup watcher per config; merging it is separate work.
  if (bundleConfig.watch) return 'watch mode'

  const exportPaths = Object.keys(entries)
  if (exportPaths.length < 2) {
    return `only ${exportPaths.length} entry resolved`
  }

  for (const [exportPath, exportCondition] of Object.entries(entries)) {
    // `prependShebang` is bound to one specific entry file.
    if (isBinExportPath(exportPath)) {
      return `"${exportPath}" is a bin entry`
    }
    for (const target of exportCondition.targets) {
      // Runtime/optimize conditions (`react-server`, `browser`, `development`,
      // …) change the inlined env and which sibling bundle an import should
      // resolve to, which the alias plugin decides per entry.
      const special = target.conditions.find((condition) =>
        specialExportConventions.has(condition),
      )
      if (special) {
        return `"${exportPath}" uses the "${special}" condition`
      }
    }
  }

  if (await hasBoundaryDirectives(entries)) {
    return `package uses 'use client' / 'use server' boundaries`
  }

  return undefined
}

/** `.` -> `index`, `./a` -> `a`, `./foo/bar` -> `foo/bar` */
function toInputName(exportPath: string): string {
  return exportPath === '.' ? 'index' : exportPath.replace(/^\.\//, '')
}

function outputExtension(file: string): string {
  const match = /\.d\.(m|c)?ts$|\.(m|c)?js$/.exec(file)
  return match ? match[0] : ''
}

/** Deepest directory containing every one of `dirs`. */
function commonRootDir(dirs: string[]): string {
  const [first, ...rest] = dirs.map((dir) => dir.split(sep))
  let end = first.length
  for (const parts of rest) {
    let i = 0
    while (i < end && i < parts.length && parts[i] === first[i]) i++
    end = i
  }
  return first.slice(0, end).join(sep) || sep
}

/**
 * One rollup config per group of entries that can share a module graph.
 *
 * Entries group by everything that changes the *input* graph — the inlined env
 * values — plus the output format and extension, which decide the shape of the
 * generate step. Within a group entries differ only by which file they land
 * in, and `entryFileNames` resolves that per chunk.
 *
 * The `occurrence` part of the key keeps an entry that emits two files of the
 * same format and extension in two different groups: one input name cannot map
 * to two output paths.
 */
export async function buildMergedConfigs(
  bundleConfig: BundleConfig,
  buildContext: BuildContext,
  bundleEntryOptions: bundleEntryOptions,
): Promise<MergedRollupConfig[]> {
  const { entries } = buildContext
  const { dts } = bundleEntryOptions

  const groups = new Map<string, Group>()
  for (const [exportPath, exportCondition] of Object.entries(entries)) {
    // A shard owns a subset of the entries. The rest stay in `entries` so the
    // alias plugin can still resolve references to them as externals.
    if (
      bundleConfig._entryFilter &&
      !bundleConfig._entryFilter.includes(exportPath)
    ) {
      continue
    }
    const outputs = await getEntryBundleOutputs(
      bundleConfig,
      exportCondition,
      buildContext,
      bundleEntryOptions,
    )
    const env = getDefinedInlineVariables(
      bundleConfig.env || [],
      exportCondition,
    )
    const seen = new Map<string, number>()
    for (const output of outputs) {
      const shape = [
        dts ? 'dts' : 'js',
        output.format,
        outputExtension(output.file),
        JSON.stringify(env),
      ].join('|')
      const occurrence = seen.get(shape) ?? 0
      seen.set(shape, occurrence + 1)

      const key = occurrence === 0 ? shape : `${shape}|#${occurrence}`
      let group = groups.get(key)
      if (!group) {
        group = { key, items: [] }
        groups.set(key, group)
      }
      group.items.push({ exportPath, exportCondition, output })
    }
  }

  if (process.env.DEBUG) {
    for (const { key, items } of groups.values()) {
      logger.log(`Merged group "${key}": ${items.length} entries`)
    }
  }

  const configs: MergedRollupConfig[] = []
  for (const group of groups.values()) {
    configs.push(
      await buildMergedConfig(group, bundleConfig, buildContext, dts),
    )
  }
  return configs
}

/**
 * How many ways to split the types work across workers.
 *
 * Declaration emit is linear in entry count and one shared graph cannot
 * amortise it, so the only lever is running several at once — and only in
 * separate heaps. Four was the floor on a 57-entry package; past that each
 * extra TypeScript program costs more than the parallelism it buys.
 */
export function typeShardCount(entryCount: number, cores: number): number {
  const override = Number(process.env.BUNCHEE_DTS_SHARDS)
  if (Number.isFinite(override) && override > 0) return Math.floor(override)

  // Below this a shard spends longer starting a program than emitting types.
  const MIN_ENTRIES_PER_SHARD = 8
  return Math.max(
    1,
    Math.min(4, cores, Math.floor(entryCount / MIN_ENTRIES_PER_SHARD)),
  )
}

/** Split into `count` contiguous groups of near-equal size. */
export function shardEntries(names: string[], count: number): string[][] {
  if (count <= 1) return [names]
  const groups: string[][] = []
  const size = Math.ceil(names.length / count)
  for (let i = 0; i < names.length; i += size) {
    groups.push(names.slice(i, i + size))
  }
  return groups
}

async function buildMergedConfig(
  group: Group,
  bundleConfig: BundleConfig,
  buildContext: BuildContext,
  dts: boolean,
): Promise<MergedRollupConfig> {
  const { cwd } = buildContext
  const { items } = group

  const input: Record<string, string> = {}
  /** input name -> absolute output file */
  const outputFiles = new Map<string, string>()
  for (const item of items) {
    const name = toInputName(item.exportPath)
    input[name] = item.exportCondition.source
    outputFiles.set(name, resolve(cwd, item.output.file))
  }

  // The first entry stands in for the group when building the options shared
  // across it: format, sourcemap, interop, chunk naming.
  const [representative] = items
  const representativeCondition: ParsedExportCondition = {
    ...representative.exportCondition,
    targets: [representative.output.target],
  }
  const representativeBundleConfig: BundleConfig = {
    ...bundleConfig,
    file: representative.output.file,
    format: representative.output.format,
  }

  const { input: _entryInput, ...inputOptions } = await buildInputConfig(
    representative.exportCondition.source,
    representativeBundleConfig,
    representativeCondition,
    buildContext,
    dts,
    input,
  )

  const outputOptions = await buildOutputConfigs(
    representativeBundleConfig,
    representativeCondition,
    buildContext,
    dts,
  )

  const dir = commonRootDir([...outputFiles.values()].map((f) => dirname(f)))

  return {
    ...inputOptions,
    input,
    outputs: [
      {
        ...outputOptions,
        dir,
        // Each entry keeps the exact path its export condition declares, which
        // the per-entry path gets for free from a single `output.file`.
        entryFileNames(chunk) {
          const file = outputFiles.get(chunk.name)
          if (!file) {
            throw new Error(
              `bunchee: no output file mapped for merged entry "${chunk.name}"`,
            )
          }
          return normalizePath(relative(dir, file))
        },
      },
    ],
  }
}
