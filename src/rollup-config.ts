import fs from "fs";
import { resolve, extname, dirname } from "path";
import commonjs from "rollup-plugin-commonjs";
// @ts-ignore rollup-plugin-preserve-shebang is untyped module
import shebang from "rollup-plugin-preserve-shebang"; 
import json from "@rollup/plugin-json";
import babel from "@rollup/plugin-babel";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import config from "./config";
import type { OutputOptions, Plugin } from "rollup";
import { terser } from "rollup-plugin-terser";
import type { PackageMetadata, BuncheeRollupConfig, CliArgs, BundleOptions } from "./types";

type SupportedFields = "main" | "module"

const mainFieldsConfig: {
  field: SupportedFields
  format: "cjs" | "esm"
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

// ts doesn't support type `Module`
const { Module } = require("module");
function resolveTypescript() {
  let ts;
  const m = new Module("", null);
  m.paths = Module._nodeModulePaths(config.rootDir)
  try {
    ts = m.require("typescript");
  } catch (_) {
    ts = require("typescript");
  }
  return ts;
}

function getDistPath(pkg: PackageMetadata, filed: SupportedFields = 'main') {
  return pkg[filed] || 'dist/index.js'
}

function createInputConfig(
  entry: string,
  pkg: PackageMetadata,
  options: BundleOptions,
) {
  const externals = [pkg.peerDependencies, pkg.dependencies]
    .filter(<T>(n?: T): n is T => Boolean(n))
    .map((o: { [key: string]: string }): string[] => Object.keys(o))
    .reduce((a: string[], b: string[]) => a.concat(b), [] as string[]);
  
  const {useTypescript, minify = false} = options;
  const typings: string | undefined = pkg.types || pkg.typings

  const plugins: (Plugin)[] = [
    nodeResolve({
      preferBuiltins: false, // TODO: support node target
    }),
    commonjs({
      include: /node_modules\//,
    }),
    json(),
    shebang(),
    useTypescript && typescript({
      tsconfig: resolve(config.rootDir, "tsconfig.json"),
      typescript: resolveTypescript(),
      module: "ES6",
      target: "ES5",
      declaration: !!typings,
      ...(!!typings && {
        declarationDir: dirname(resolve(config.rootDir, typings)),
      })
    }),
    !useTypescript && babel({
      babelHelpers: "bundled",
      babelrc: false,
      configFile: false,
      exclude: "node_modules/**",
      presets: [
        ["babel-preset-o", {nodeVersion: process.env.NODE_VERSION || "4.0.0"}]
      ],
    }),
    minify && terser({
      compress: {
        "keep_infinity": true,
      },
      format: {
        "comments": /^\s*([@#]__[A-Z]__\s*$|@[a-zA-Z]\s*$)/,
        "wrap_func_args": false,
        "preserve_annotations": true,
      }
    }),
  ].filter((n: (Plugin | false)): n is Plugin => Boolean(n));
  
  return {
    input: entry,
    external: externals,
    plugins,
  };
}

function createOutputOptions(
  options: BundleOptions,
  pkg: PackageMetadata
): OutputOptions {
  const {file, format, useTypescript} = options;
  
  let tsconfigOptions = {} as any;
  const ts = resolveTypescript();
  const tsconfigPath = resolve(config.rootDir, "tsconfig.json");
  if (useTypescript) {
    if (fs.existsSync(tsconfigPath)) {
      const tsconfigJSON = ts.readConfigFile(tsconfigPath, ts.sys.readFile)
        .config;
      tsconfigOptions = ts.parseJsonConfigFileContent(
        tsconfigJSON,
        ts.sys,
        './',
      ).options;
    }
  }
  
  
  // respect if tsconfig.json has `esModuleInterop` config;
  // add esmodule mark if cjs and esmodule are both specified;
  const useEsModuleMark = !!tsconfigOptions.esModuleInterop ||
    (
      pkg.hasOwnProperty("main") && 
      pkg.hasOwnProperty("module")
    );
    
  return {
    name: pkg.name,
    file,
    format,
    esModule: !useEsModuleMark && format !== "umd",
    freeze: false,
    strict: false,
    sourcemap: true,
  };
}

function createRollupConfig(
  entry: string,
  pkg: PackageMetadata,
  cliArgs: CliArgs,
): BuncheeRollupConfig {
  const { file, format = "esm" } = cliArgs;
  const ext = extname(entry);
  const useTypescript: boolean = ext === ".ts" || ext === ".tsx";
  const options = {...cliArgs, useTypescript};
  const inputOptions = createInputConfig(entry, pkg, options);
  let outputConfigs = mainFieldsConfig
    .filter((config) => {
      return Boolean(pkg[config.field])
    })
    .map((config) => {
      const filename = getDistPath(pkg, config.field)
      return createOutputOptions(
        {
          file: filename, 
          format: config.format,
          useTypescript,
        },
        pkg
      );
    });

  // CLI output option is always prioritized
  if (file) {
    outputConfigs = [
      createOutputOptions(
        {
          file, 
          format, 
          useTypescript,
        }, 
        pkg
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
