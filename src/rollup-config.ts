import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";
import buble from "@rollup/plugin-buble";
import nodeResolve from "@rollup/plugin-node-resolve";
import { PackageMetadata, BuncheeRollupConfig } from "./types";
import { OutputOptions } from "rollup";

const mainFieldsConfig: {
  field: "main" | "module";
  format: "cjs" | "esm";
}[] = [
  {
    field: "main",
    format: "cjs",
  },
  {
    field: "module",
    format: "esm",
  },
];

function createInputConfig(
  entry: string,
  npmPackage: PackageMetadata,
  options: {
    jsx: string | undefined;
  }
) {
  const externals = [npmPackage.peerDependencies, npmPackage.dependencies]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: string }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[]);

  return {
    input: entry,
    external: externals,
    plugins: [
      nodeResolve({
        preferBuiltins: false,
      }),
      commonjs({
        include: /node_modules\//,
      }),
      json(),
      buble({
        exclude: "node_modules/**",
        jsx: options.jsx,
        objectAssign: "Object.assign",
        transforms: {
          dangerousForOf: true,
          dangerousTaggedTemplateString: true,
        },
      }),
    ],
  };
}

function createOutputOptions(
  file: any,
  format: OutputOptions["format"],
  npmPackage: PackageMetadata
): OutputOptions {
  return {
    name: npmPackage.name,
    file,
    format,
    esModule: format !== "umd",
    freeze: false,
    strict: false,
    sourcemap: true,
  };
}

function createRollupConfig({
  entry,
  npmPackage,
  options,
}: {
  entry: string;
  npmPackage: PackageMetadata;
  options: {
    file: string;
    format: OutputOptions["format"];
    jsx?: string;
  };
}): BuncheeRollupConfig {
  const { file, format = "esm", jsx } = options;
  const inputOptions = createInputConfig(entry, npmPackage, {
    jsx,
  });

  let outputConfigs = mainFieldsConfig
    .filter((config) => Boolean(npmPackage[config.field]))
    .map((config) => {
      const filename = npmPackage[config.field];
      return createOutputOptions(filename, config.format, npmPackage);
    });

  // CLI output option is always prioritized
  if (file) {
    outputConfigs = [createOutputOptions(file, format, npmPackage)];
  }

  return {
    input: inputOptions,
    output: outputConfigs,
    treeshake: {
      propertyReadSideEffects: false,
    },
  };
}

export default createRollupConfig;
