import type { JscTarget } from '@swc/types'
import type { InputOptions, OutputOptions } from 'rollup'
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

type ExportCondition =
  | string
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

  // hooks
  /*
   * This hook is called before the build starts
   * @experimental
   */
  _callbacks?: {
    onBuildStart?: (state: any) => void

    /*
     * This hook is called before the build starts
     * @experimental
     */
    onBuildEnd?: (assetJobs: any) => void

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
  input: string
}

type BuncheeRollupConfig = CustomRollupInputOptions & {
  output: OutputOptions
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
  prepare?: boolean
  clean?: boolean
  tsconfig?: string
  onSuccess?: string
}

type BundleOptions = BundleConfig

type ParsedExportCondition = {
  source: string
  name: string
  export: FullExportCondition
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
  PackageType,
  ParsedExportCondition,
  Entries,
  BuildContext,
  BundleJobOptions,
  bundleEntryOptions,
  BrowserslistConfig,
  CustomRollupInputOptions,
}
