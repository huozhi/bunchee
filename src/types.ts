import type { InputOptions, OutputOptions, RollupOptions } from "rollup";

type ExportType = "require" | "export" | "default" | string // omit other names

// Shared config for each build entry
type CommonConfig = {
  format?: OutputOptions["format"];
  minify?: boolean;
  sourcemap?: boolean;
  external?: string[];
  target?: string;
}

type BuildConfig = CommonConfig & {
  entry: Record<string, string>;
}

type PackageMetadata = {
  name?: string;
  main?: string;
  module?: string;
  type?: "commonjs" | "module"
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: string | Record<string, ExportCondition>;
  types?: string;
  typings?: string;
  bunchee?: BuildConfig;
};

type ExportCondition =
  | string
  | Record<ExportType, string>

type BuncheeRollupConfig = Partial<Omit<RollupOptions, 'input' | 'output'>> & {
  input: InputOptions;
  output: OutputOptions[];
};

type CliArgs = CommonConfig & {
  file?: string;
  watch?: boolean;
  cwd?: string;
}

type BundleOptions = CliArgs & {
  useTypescript: boolean;
}

export type {
  CliArgs,
  ExportType,
  BundleOptions,
  ExportCondition,
  PackageMetadata,
  BuncheeRollupConfig,
 };
