import { InputOptions, OutputOptions, TreeshakingOptions } from "rollup";

type PackageMetadata = {
  name?: string;
  main?: string;
  module?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  exports?: string | Record<string, string>
  types?: string,
  typings?: string,
};

type BuncheeRollupConfig = {
  input: InputOptions;
  output: OutputOptions[];
  treeshake: TreeshakingOptions;
};

type CliArgs = {
  file?: string;
  format?: OutputOptions["format"];
  minify?: boolean;
  watch?: boolean;
  target?: string;
  cwd?: string;
  sourcemap?: boolean;
}

type BundleOptions = CliArgs & {
  useTypescript: boolean;
}


export { 
  CliArgs,
  BundleOptions,
  PackageMetadata,
  BuncheeRollupConfig, 
 };
