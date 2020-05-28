import rollup, { RollupWatcher, RollupWatchOptions } from "rollup";
import createRollupConfig from "./rollup-config";
import utils from "./utils";
import { BuncheeRollupConfig } from "./types";

function createBundle(
  entry: string,
  { watch, ...options }: { file: any; format: any; watch: boolean; jsx: any }
) {
  const npmPackage = utils.getPackageMeta();
  const rollupConfig = createRollupConfig({
    entry,
    npmPackage: npmPackage,
    options,
  });

  if (watch) {
    return rollupWatch(rollupConfig);
  }
  return rollupBundle(rollupConfig);
}

function rollupWatch({ input, output }: BuncheeRollupConfig): RollupWatcher {
  const watchOptions: RollupWatchOptions = {
    ...input,
    output: output,
    watch: {
      exclude: ["node_modules/**"],
    },
  };
  return rollup.watch(watchOptions);
}

function rollupBundle({ input, output }: BuncheeRollupConfig) {
  return rollup.rollup(input).then(
    (bundle) => {
      const wirteJobs = output.map((options: rollup.OutputOptions) =>
        bundle.write(options)
      );
      return Promise.all(wirteJobs);
    },
    (error) => {
      console.log(error);
      console.error(error.snippet); // logging source code in format
    }
  );
}

export default createBundle;
