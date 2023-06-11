import type { JscTarget } from '@swc/core'
import type { InputOptions, OutputOptions, RollupOptions } from 'rollup'

type PackageType = 'commonjs' | 'module'

type ExportType =
  | 'import'
  | 'module'
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

type ExportCondition = string | {
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
  external?: string[]
  noExternal?: boolean
  env?: string[]
  dts?: boolean
  runtime?: string

  // assigned extra config, default is '.' export
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

type ParsedExportCondition = {
  source: string
  name: string
  export: FullExportCondition
}

export type {
  ExportType,
  CliArgs,
  BundleConfig,
  BundleOptions,
  ExportCondition,
  PackageMetadata,
  BuildMetadata,
  FullExportCondition,
  BuncheeRollupConfig,
  PackageType,
  ParsedExportCondition,
}
