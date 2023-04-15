import type { JscTarget } from '@swc/core'
import type { InputOptions, OutputOptions, RollupOptions } from 'rollup'

type ExportType = 'require' | 'export' | 'default' | string // omit other names

// configs which are normalized from cli args
type BundleConfig = {
  file?: string
  cwd?: string
  watch?: boolean
  target?: JscTarget
  format?: OutputOptions['format']
  minify?: boolean
  sourcemap?: boolean
  external?: string[]
  noExternal?: boolean
  env?: string[]
  dts?: boolean
  runtime?: string

  // assigned extra config
  exportCondition?: {
    source: string // detected source file
    name: string // export condition name
    export: ExportCondition // export condition value
  }
}

type PackageMetadata = {
  name?: string
  main?: string
  module?: string
  type?: 'commonjs' | 'module'
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, Record<string, string>>
  exports?: string | Record<string, ExportCondition>
  types?: string
  typings?: string
}

type ExportCondition = string | Record<ExportType, string>

type BuncheeRollupConfig = Partial<Omit<RollupOptions, 'input' | 'output'>> & {
  exportName?: string
  input: InputOptions
  output: OutputOptions[]
}

type CliArgs = {
  format?: OutputOptions['format']
  minify?: boolean
  sourcemap?: boolean
  source? : string
  file?: string
  watch?: boolean
  cwd?: string
  target?: JscTarget
  help?: boolean
  version?: boolean
  env?: string
  external?: string
  dts?: boolean
  runtime?: string
  noExternal?: boolean
}

type BundleOptions = BundleConfig & {
  useTypescript: boolean
}

type BuildMetadata = {
  source: string
}

export type {
  CliArgs,
  ExportType,
  BundleConfig,
  BundleOptions,
  ExportCondition,
  PackageMetadata,
  BuildMetadata,
  BuncheeRollupConfig
}
