import type { OutputTarget } from './exports'
import type { JscTarget } from '@swc/types'
import type { InputOptions, OutputOptions, Plugin } from 'rollup'
import type { OutputState } from './plugins/output-state-plugin'
import type { TypescriptOptions } from './typescript'

type PackageType = 'commonjs' | 'module'

type ExportType =
  | 'import'
  | 'module'
  | 'module-sync'
  | 'require'
  | 'default'
  | 'node'
  | 'react-server'
  | 'react-native'
  | 'browser'
  | 'edge-light'
  | 'types'

type FullExportCondition = {
  [key: string]: string
}

// `null` is valid in package.json `exports` and blocks a subpath from resolving.
type ExportCondition =
  | string
  | null
  | {
      [key: string]: ExportCondition | string
    }

// configs which are normalized from cli args
type BundleConfig = {
  file?: string
  cwd?: string
  watch?: boolean
  target?: JscTarget
  format?: OutputOptions['format']
  minify?: boolean
  sourcemap?: boolean
  external?: string[] | null
  env?: string[]
  dts?: { respectExternal?: boolean } | false
  runtime?: string
  pkg?: PackageMetadata
  clean?: boolean
  tsconfig?: string
  onSuccess?: string | (() => void | Promise<void>)

  /*
   * Build only the type declarations, skipping the JS assets. Set when merged
   * rollup instances have already produced the JS on the main thread and the
   * workers are left with the types.
   * @internal
   */
  _typesOnly?: boolean

  /*
   * Only build the entries with these export paths (e.g. ['./foo']).
   * Set by the worker pool to assign one entry per worker.
   * @internal
   */
  _entryFilter?: string[]

  // hooks
  /*
   * This hook is called before the build starts
   * @experimental
   */
  _callbacks?: {
    onBuildStart?: (state: any) => void

    /*
     * This hook is called when the build finishes.
     * `assetJobs` holds one item per completed build job; what the items are
     * depends on the path taken (rollup outputs, watchers, or per-entry size
     * stats from the worker pool), so only its length is meaningful.
     * @experimental
     */
    onBuildEnd?: (assetJobs: any[]) => void

    /*
     * This hook is called when the build errors
     * @experimental
     */
    onBuildError?: (assetJob: any) => void
  }
}

type PackageMetadata = {
  name?: string
  main?: string
  bin?: string | Record<string, string>
  module?: string
  files?: string[]
  type?: 'commonjs' | 'module'
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, Record<string, string>>
  exports?: string | Record<string, ExportCondition>
  types?: string
  typings?: string
  browserslist?: BrowserslistConfig
}

type CustomRollupInputOptions = Pick<
  InputOptions,
  'external' | 'plugins' | 'treeshake' | 'onwarn'
> & {
  /** A single entry, or `{ <entry name>: <source path> }` for a merged build. */
  input: string | Record<string, string>
}

type BuncheeRollupConfig = CustomRollupInputOptions & {
  output: OutputOptions
}

/** One rollup build shared by many entries: a single module graph. */
type MergedRollupConfig = CustomRollupInputOptions & {
  input: Record<string, string>
  /**
   * One per file set this graph is written as. More than one when the same
   * inputs are emitted in several formats — the graph is built once and written
   * per output, the way a rollup config with an `output` array behaves.
   */
  output: OutputOptions[]
}

type CliArgs = {
  format?: OutputOptions['format']
  minify?: boolean
  sourcemap?: boolean
  source?: string
  file?: string
  watch?: boolean
  cwd?: string
  target?: JscTarget
  help?: boolean
  version?: boolean
  env?: string
  external?: string | null
  dts?: false
  dtsBundle?: boolean
  runtime?: string
  clean?: boolean
  tsconfig?: string
  onSuccess?: string
}

type BundleOptions = BundleConfig

type ParsedExportCondition = {
  source: string
  name: string
  /** Every output file this entry produces. */
  targets: OutputTarget[]
}

type ExportPaths = Record<string, FullExportCondition>

type Entries = Record<string, ParsedExportCondition>

type BrowserslistConfig = string | string[] | Record<string, string>

type BuildContext = {
  entries: Entries
  pkg: PackageMetadata
  cwd: string
  tsOptions: TypescriptOptions
  useTypeScript: boolean
  browserslistConfig: BrowserslistConfig | undefined
  pluginContext: {
    outputState: OutputState
    moduleDirectiveLayerMap: Map<string, Set<[string, string]>>
    /**
     * One declaration plugin per package build. The plugin owns the TypeScript
     * Programs that compatible declaration graphs reuse.
     */
    dtsPlugin?: Promise<Plugin>
  }
}

type BundleJobOptions = {
  isFromCli: boolean
  generateTypes: boolean
}

type bundleEntryOptions = {
  dts: boolean
  isFromCli: boolean
}

export type {
  ExportPaths,
  ExportType,
  CliArgs,
  BundleConfig,
  BundleOptions,
  ExportCondition,
  PackageMetadata,
  FullExportCondition,
  BuncheeRollupConfig,
  MergedRollupConfig,
  PackageType,
  ParsedExportCondition,
  Entries,
  BuildContext,
  BundleJobOptions,
  bundleEntryOptions,
  BrowserslistConfig,
  CustomRollupInputOptions,
}
