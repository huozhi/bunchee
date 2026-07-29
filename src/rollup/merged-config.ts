import { dirname, relative, resolve, sep } from 'path'
import type { OutputOptions } from 'rollup'
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
import { buildSourceToBundleMap } from '../plugins/alias-plugin'
import { getEntryBundleOutputs } from '../build-config'
import { isESModulePackage, normalizePath } from '../utils'
import { getSpecialExportTypeFromConditionNames } from '../entries'
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
  /**
   * The parts of the key that describe the *input* graph rather than how it is
   * written: the inlined env, the condition imports resolve through, and which
   * occurrence of that shape this is. Groups agreeing here are candidates for
   * sharing one graph.
   */
  graphKey: string
  items: GroupItem[]
  /** Absolute output file -> the source that claimed it. */
  claimed: Map<string, string>
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
      const graphShape = [
        JSON.stringify(env),
        // Which sibling bundle an import resolves to is decided per runtime or
        // optimize condition, so entries only share a graph with entries that
        // resolve the same way.
        getSpecialExportTypeFromConditionNames(
          new Set(output.target.conditions),
        ),
      ]
      const shape = [
        dts ? 'dts' : 'js',
        output.format,
        outputExtension(output.file),
        ...graphShape,
      ].join('|')
      const occurrence = seen.get(shape) ?? 0
      seen.set(shape, occurrence + 1)

      // Two entries can resolve to the same output file — `./a` picking up the
      // `workerd` condition and `./a.workerd` both land on `a.workerd.js`.
      // Built one at a time they overwrite each other; in one graph they are
      // two inputs, and rollup would keep both by numbering the second.
      const file = resolve(buildContext.cwd, output.file)
      let group: Group | undefined
      for (let attempt = occurrence; ; attempt++) {
        const key = attempt === 0 ? shape : `${shape}|#${attempt}`
        const candidate = groups.get(key) ?? {
          key,
          graphKey: JSON.stringify([...graphShape, attempt]),
          items: [],
          claimed: new Map(),
        }
        groups.set(key, candidate)
        const claimedBy = candidate.claimed.get(file)
        if (claimedBy === exportCondition.source) {
          // The same source writing the same file: nothing to add.
          group = undefined
          break
        }
        if (claimedBy == null) {
          group = candidate
          break
        }
        // A different source wants this file. Keep them in separate graphs so
        // the later one still overwrites, exactly as it does today.
      }
      if (!group) continue
      group.claimed.set(file, exportCondition.source)
      group.items.push({ exportPath, exportCondition, output })
    }
  }

  if (process.env.DEBUG) {
    for (const { key, items } of groups.values()) {
      logger.log(`Merged group "${key}": ${items.length} entries`)
    }
  }

  const configs: MergedRollupConfig[] = []
  for (const graph of coalesceGroups([...groups.values()], buildContext, dts)) {
    configs.push(
      await buildMergedConfig(graph, bundleConfig, buildContext, dts),
    )
  }
  return configs
}

/** The input name -> source pairs a group builds, in a comparable form. */
function inputSignature(group: Group): string {
  return JSON.stringify(
    group.items
      .map((item) => [
        toInputName(item.exportPath),
        item.exportCondition.source,
      ])
      .sort(),
  )
}

/**
 * Groups that differ only in what they are written as, collapsed into one graph.
 *
 * A package that publishes both `import` and `require` describes the same
 * entries twice, and the two only diverge once rollup starts generating: the
 * modules parsed, transformed and tree-shaken to get there are the same work.
 * Built as separate groups that work is done once per format.
 *
 * Two groups can share a graph when they take the same inputs and the alias
 * plugin would rewrite them the same way. The second condition is what keeps
 * this honest: which sibling bundle an import of an entry outside the graph
 * resolves to is chosen per format, so groups whose maps disagree still get a
 * graph each.
 */
function coalesceGroups(
  groups: Group[],
  buildContext: BuildContext,
  dts: boolean,
): Group[][] {
  const { entries, pkg } = buildContext
  const isESMPkg = isESModulePackage(pkg.type)

  const aliasSignature = (group: Group): string => {
    const [representative] = group.items
    const owned = new Set(
      group.items.map((item) => item.exportCondition.source),
    )
    const map = buildSourceToBundleMap({
      entries,
      format: representative.output.format,
      isESMPkg,
      exportCondition: {
        ...representative.exportCondition,
        targets: [representative.output.target],
      },
      dts,
    })
    // An input of this graph is emitted by rollup as a chunk, so its entry in
    // the map is never read. Only the sources this graph does not own get
    // rewritten, and only those have to agree between the two outputs.
    return JSON.stringify(
      [...map].filter(([source]) => !owned.has(source)).sort(),
    )
  }

  const graphs = new Map<string, Group[]>()
  for (const group of groups) {
    const key = JSON.stringify([
      group.graphKey,
      inputSignature(group),
      aliasSignature(group),
    ])
    const existing = graphs.get(key)
    if (existing) existing.push(group)
    else graphs.set(key, [group])
  }

  if (process.env.DEBUG) {
    for (const members of graphs.values()) {
      if (members.length > 1) {
        logger.log(
          `Sharing one graph across ${members.length} outputs: ` +
            members.map((member) => member.key).join(' + '),
        )
      }
    }
  }
  return [...graphs.values()]
}

/**
 * How many ways to split the types work across workers.
 *
 * Declaration emit splits into a fixed cost — standing up a TypeScript program,
 * around 400ms — and a per-entry cost that grows as the program does. Sharding
 * divides the second but pays the first once per shard, so it only wins once
 * the per-entry side dominates: measured serially, declarations cost 573ms at
 * 21 entries, 706ms at 42, and 3180ms at 201.
 *
 * That makes entry count, not core count, the thing worth gating on. A shard
 * per 4 entries sent a 21-entry package straight to the cap and made it slower
 * than not sharding at all.
 */
export function typeShardCount(entryCount: number, cores: number): number {
  const override = Number(process.env.BUNCHEE_DTS_SHARDS)
  if (Number.isFinite(override) && override > 0) return Math.floor(override)

  // Two is the setting that holds up in both directions. On an idle machine a
  // third and fourth shard buy another 3% at 201 entries, but they cost a
  // program each, and on a machine whose cores are already busy — CI, or a
  // build sharing a laptop — that extra CPU comes straight back as wall clock:
  // four shards ran 10% slower than two at 201 entries and 20% slower at 42.
  //
  // The second shard only starts paying for itself around 40 entries. Below 20
  // it is a wash, so keep those on one program and one heap.
  const MAX_SHARDS = 2
  const MIN_ENTRIES_PER_SHARD = 20
  return Math.min(
    MAX_SHARDS,
    cores,
    Math.max(1, Math.ceil(entryCount / MIN_ENTRIES_PER_SHARD)),
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
  /**
   * The groups sharing this graph — one per output. They take the same inputs,
   * so only where each entry lands differs between them.
   */
  graph: Group[],
  bundleConfig: BundleConfig,
  buildContext: BuildContext,
  dts: boolean,
): Promise<MergedRollupConfig> {
  const { cwd } = buildContext
  const [primary] = graph

  const input: Record<string, string> = {}
  for (const item of primary.items) {
    input[toInputName(item.exportPath)] = item.exportCondition.source
  }

  // The first entry of the first group stands in for the graph when building the
  // options shared across it: format, sourcemap, interop, chunk naming.
  const [representative] = primary.items
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

  const output: OutputOptions[] = []
  for (const group of graph) {
    const [groupRepresentative] = group.items
    /** input name -> absolute output file */
    const outputFiles = new Map<string, string>()
    /**
     * Same, keyed by source. Rollup sanitises an input name before it reaches
     * `chunk.name` — a bin entry's `$binary` arrives as `_binary` — so the
     * source behind the chunk is the reliable way back to its output path.
     */
    const outputFilesBySource = new Map<string, string>()
    for (const item of group.items) {
      const file = resolve(cwd, item.output.file)
      outputFiles.set(toInputName(item.exportPath), file)
      outputFilesBySource.set(item.exportCondition.source, file)
    }

    const groupBundleConfig: BundleConfig = {
      ...bundleConfig,
      file: groupRepresentative.output.file,
      format: groupRepresentative.output.format,
    }
    const outputOptions = await buildOutputConfigs(
      groupBundleConfig,
      {
        ...groupRepresentative.exportCondition,
        targets: [groupRepresentative.output.target],
      },
      buildContext,
      dts,
      true,
    )

    const dir = commonRootDir([...outputFiles.values()].map((f) => dirname(f)))
    output.push({
      ...outputOptions,
      dir,
      // Each entry keeps the exact path its export condition declares, which
      // the per-entry path gets for free from a single `output.file`.
      entryFileNames(chunk) {
        const file =
          (chunk.facadeModuleId &&
            outputFilesBySource.get(chunk.facadeModuleId)) ||
          outputFiles.get(chunk.name)
        if (!file) {
          throw new Error(
            `bunchee: no output file mapped for merged entry "${chunk.name}"`,
          )
        }
        return normalizePath(relative(dir, file))
      },
    })
  }

  return { ...inputOptions, input, output }
}
