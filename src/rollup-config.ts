import path from "path";
import commonjs from "rollup-plugin-commonjs";
import json from "@rollup/plugin-json";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { PackageMetadata, BuncheeRollupConfig, CliArgs } from "./types";
import { OutputOptions, Plugin } from "rollup";
import config from "./config";

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
) {
  const externals = [npmPackage.peerDependencies, npmPackage.dependencies]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: string }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[]);
  const ext = path.extname(entry);
  const useTypescript: boolean = ext === ".ts" || ext === ".tsx";
  const plugins: (Plugin)[] = [
    nodeResolve({
      preferBuiltins: false,
    }),
    commonjs({
      include: /node_modules\//,
    }),
    json(),
    useTypescript && typescript({
      tsconfig: path.resolve(config.rootDir, "tsconfig.json"),
      typescript: require("typescript"),
      module: "ES6",
      target: "ES5",
    }),
    !useTypescript && babel({
      babelHelpers: 'bundled',
      babelrc: false,
      configFile: false,
      exclude: 'node_modules/**',
      presets: [
        require.resolve('@babel/preset-react'),
        [
          require.resolve('@babel/preset-env'),
          {
            loose: true,
            useBuiltIns: false,
            targets: {
              node: '4',
              esmodules: true,
            },
          },
        ]
      ],
    })
  ].filter((n: (Plugin | false)): n is Plugin => Boolean(n));
  
  return {
    input: entry,
    external: externals,
    plugins,
  };
}

function createOutputOptions(
  cliArgs: CliArgs,
  npmPackage: PackageMetadata
): OutputOptions {
  const {file, format, shebang} = cliArgs;
  return {
    name: npmPackage.name,
    banner: shebang ? '#!/usr/bin/env node' : undefined,
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
  options: CliArgs;
}): BuncheeRollupConfig {
  const { file, format = "esm" } = options;
  const inputOptions = createInputConfig(entry, npmPackage);

  let outputConfigs = mainFieldsConfig
    .filter((config) => {
      return Boolean(npmPackage[config.field])
    })
    .map((config) => {
      const filename = npmPackage[config.field];
      return createOutputOptions(
        {
          file: filename, 
          format: config.format,
          shebang: options.shebang,
        },
        npmPackage
      );
    });

  // CLI output option is always prioritized
  if (file) {
    outputConfigs = [
      createOutputOptions(
        {
          file, 
          format, 
          shebang: options.shebang
        }, 
        npmPackage
      )
    ];
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
