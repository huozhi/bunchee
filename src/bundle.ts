import type { RollupWatcher, RollupWatchOptions, OutputOptions, RollupBuild } from "rollup"
import type { BuncheeRollupConfig, CliArgs } from "./types";

import fs from "fs";
import { resolve } from "path";
import { watch as rollupWatch, rollup } from "rollup";
import createRollupConfig from "./rollup-config";
import { getPackageMeta } from "./utils";
import config from "./config";

function assignDefault(options: CliArgs, name: keyof CliArgs, defaultValue: any) {
  if (!(name in options) || options[name] == null) {
    options[name] = defaultValue
  }
}

function bundle(
  entryPath: string,
  { cwd, ...options } : CliArgs = {}
): Promise<any> {
  config.rootDir = resolve(process.cwd(), cwd || "");
  assignDefault(options, "format", "es")
  assignDefault(options, "sourcemap", true)

  // alias for 'es' in rollup
  if (options.format === "esm") {
    options.format = "es"
  }

  const npmPackage = getPackageMeta();
  const { entry: entries, ...customConfig } = npmPackage.bunchee || {};
  const isSingleEntry = typeof entries === 'string'
  const hasMultiEntries = entries
    && !isSingleEntry
    && Object.keys(entries).length > 0;

  if (isSingleEntry) {
    entryPath = resolve(config.rootDir, entries)
  }

  if (!fs.existsSync(entryPath)) {
    const hasEntryFile =
      entryPath === '' ? '' : fs.statSync(entryPath).isFile()

    if (!hasEntryFile && !hasMultiEntries) {
      const err = new Error("Entry file is not existed");
      err.name = "NOT_EXISTED";
      return Promise.reject(err);
    }

    if (hasMultiEntries) {
      Object.assign(options, customConfig);
      const rollupConfigs = Object.keys(entries).map(entryExport => {
        const source = entries[entryExport];

        const rollupConfig = createRollupConfig(
          resolve(cwd!, source),
          npmPackage,
          options,
          entryExport
        );
        return rollupConfig;
      });

      // TODO: watch mode
      return Promise.all(
        rollupConfigs.map(rollupConfig =>
          runBundle(rollupConfig)
        )
      )
    }
  }

  Object.assign(options, customConfig);
  const rollupConfig = createRollupConfig(
    entryPath,
    npmPackage,
    options,
  );

  if (options.watch) {
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
  const watcher = rollupWatch(watchOptions);
  watcher.on('event', event => {
    if (event.code === 'ERROR') {
      onError(event.error)
    }
  });
  return watcher;
}

function runBundle({ input, output }: BuncheeRollupConfig) {
  return rollup(input).then(
    (bundle: RollupBuild) => {
      const writeJobs = output.map((options: OutputOptions) =>
        bundle.write(options)
      );
      return Promise.all(writeJobs);
    },
    onError
  );
}

function onError(error: any) {
  if (!error) return
  // logging source code in format
  if (error.frame) {
    process.stdout.write(error.frame + "\n");
  }
  if (error.stack) {
    process.stdout.write(error.stack + "\n");
  }
  throw error;
}

export default bundle;
