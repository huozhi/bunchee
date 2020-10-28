import { watch as rollupWatch, rollup, RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild } from "rollup";
import createRollupConfig from "./rollup-config";
import utils from "./utils";
import { BuncheeRollupConfig, CliArgs } from "./types";

function bundle(
  entry: string,
  { watch, ...options } : CliArgs = {}
): Promise<any> {
  const npmPackage = utils.getPackageMeta();
  const rollupConfig = createRollupConfig({
    entry,
    npmPackage,
    options,
  });

  if (watch) {
    return Promise.resolve(runWatch(rollupConfig));
  }
  return runBundle(rollupConfig);
}

function runWatch({ input, output }: BuncheeRollupConfig): RollupWatcher {
  const watchOptions: RollupWatchOptions[] = [{
    ...input,
    output: output,
    watch: {
      exclude: ["node_modules/**"],
    },
  }];
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
    (error = {}) => {
      // logging source code in format
      if (error.frame) {
        process.stdout.write(error.frame + '\n');
      }
      if (error.stack) {
        process.stdout.write(error.stack + '\n');
      }
      throw error;
    }
  );
}

export default bundle;
