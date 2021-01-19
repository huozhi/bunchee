import { InputOptions, OutputOptions, TreeshakingOptions } from "rollup";

type PackageMetadata = {
  name?: string;
  main?: string;
  module?: string;
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
};

type BuncheeRollupConfig = {
  input: InputOptions;
  output: OutputOptions[];
  treeshake: TreeshakingOptions;
};

type CliArgs = {
  file?: string;
  format?: OutputOptions["format"];
  shebang?: boolean;
  watch?: boolean;
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
