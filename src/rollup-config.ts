import fs, { existsSync } from "fs";
import { resolve, extname, dirname, basename } from "path";
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
// current ts typings doesn't support type `Module`, use cjs require instead
const { Module } = require("module");

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
  return resolve(config.rootDir, pkg[filed] || 'dist/index.js')
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
  const cwd: string = config.rootDir

  const plugins: (Plugin)[] = [
    nodeResolve({
      preferBuiltins: false, // TODO: support node target
      extensions: ['.mjs', '.js', '.json', '.node', '.jsx'],
    }),
    commonjs({
      include: /node_modules\//,
    }),
    json(),
    shebang(),
    useTypescript && typescript({
      tsconfig: (() => { 
        const tsconfig = resolve(cwd, "tsconfig.json"); 
        return existsSync(tsconfig) ? tsconfig : undefined;
      })(),
      typescript: resolveTypescript(),
      
      // override default options in rollup/plugin-typescript
      jsx: "react",
      noEmitHelpers: false,
      importHelpers: false,
      module: "ES6",
      target: "ES5",
      sourceMap: options.sourcemap,
      declaration: !!typings,
      ...(!!typings && {
        declarationDir: dirname(resolve(cwd, typings)),
      })
    }),
    !useTypescript && babel({
      babelHelpers: "bundled",
      babelrc: false,
      configFile: false,
      exclude: "node_modules/**",
      presets: [
        ["babel-preset-o", { targets: {} }]
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
    external(id: string) {
      return externals.some(name => id === name || id.startsWith(name + '/'))
    },
    plugins,
  };
}

function createOutputOptions(
  options: BundleOptions,
  pkg: PackageMetadata
): OutputOptions {
  const {format, useTypescript} = options;
  const cwd: string = config.rootDir
  
  let tsconfigOptions = {} as any;
  if (useTypescript) {
    const ts = resolveTypescript();
    const tsconfigPath = resolve(cwd, "tsconfig.json");
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

  const file = resolve(options.file as string)
  return {
    name: pkg.name,
    dir: dirname(file),
    entryFileNames: basename(file),
    format,
    esModule: useEsModuleMark && format !== "umd",
    freeze: false,
    strict: false,
    sourcemap: options.sourcemap,
  };
}

function createRollupConfig(
  entry: string,
  pkg: PackageMetadata,
  cliArgs: CliArgs,
): BuncheeRollupConfig {
  const { file, format } = cliArgs;
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
          ...cliArgs,
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
          ...cliArgs,
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
