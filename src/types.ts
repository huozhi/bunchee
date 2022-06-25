import type { InputOptions, OutputOptions, RollupOptions } from "rollup";

type PackageMetadata = {
  name?: string;
  main?: string;
  module?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: string | Record<string, string>;
  types?: string;
  typings?: string;
};

type BuncheeRollupConfig = Partial<Omit<RollupOptions, 'input' | 'output'>> & {
  input: InputOptions;
  output: OutputOptions[];
};

type CliArgs = {
  file?: string;
  format?: OutputOptions["format"];
  minify?: boolean;
  watch?: boolean;
  target?: string;
  cwd?: string;
  sourcemap?: boolean;
  external?: string[];
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
