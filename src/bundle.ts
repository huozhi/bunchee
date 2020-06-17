import { watch as rollupWatch, rollup, RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild } from "rollup";
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
    return runWatch(rollupConfig);
  }
  return runBundle(rollupConfig);
}

function runWatch({ input, output }: BuncheeRollupConfig): RollupWatcher {
  const watchOptions: RollupWatchOptions = {
    ...input,
    output: output,
    watch: {
      exclude: ["node_modules/**"],
    },
  };
  return rollupWatch(watchOptions);
}

function runBundle({ input, output }: BuncheeRollupConfig) {
  return rollup(input).then(
    (bundle: RollupBuild) => {
      const wirteJobs = output.map((options: OutputOptions) =>
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
