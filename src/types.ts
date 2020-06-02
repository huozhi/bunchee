import { InputOptions, OutputOptions, TreeshakingOptions } from "rollup";

type PackageMetadata = {
  name?: any;
  main?: any;
  module?: any;
  dependencies?: { [key: string]: string };
  peerDependencies?: { [key: string]: string };
};

type BuncheeRollupConfig = {
  input: InputOptions;
  output: OutputOptions[];
  treeshake: TreeshakingOptions;
};

export { BuncheeRollupConfig, PackageMetadata };
