import type { InputOptions, OutputOptions, RollupOptions } from "rollup";

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
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: string | Record<string, string>;
  types?: string;
  typings?: string;
  bunchee?: BuildConfig;
};

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
  BundleOptions,
  PackageMetadata,
  BuncheeRollupConfig,
 };
