#!/usr/bin/env node

import type { CliArgs } from "./types";

import path from "path";
import { parseCliArgs, logger } from "./utils";
import { version } from "../package.json";

const helpMessage = `
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -m, --minify           compress output. false by default
  -o, --output <file>    specify output filename
  -f, --format <format>  specify bundle type: "esm", "cjs", "umd". "esm" by default
  -e, --external <mod>   specify an external dependency
  --target <target>      build environment, use "node" for nodejs runtime
  --no-sourcemap         disable sourcemap generation, sourcemap generation is enabled by default
  --cwd <cwd>            specify current working directory
  -h, --help             output usage information
`

function help() {
  console.log(helpMessage);
}

function exit(err: Error) {
  logger.error(err);
  process.exit(2);
}

async function run(args: any) {
  const { source, format, watch, minify, sourcemap, target } = args;
  const cwd = args.cwd || process.cwd()
  const file = args.file ? path.resolve(cwd, args.file) : args.file
  const outputConfig: CliArgs = {
    file,
    format,
    cwd,
    target,
    external: args.external || [],
    watch: !!watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
  };
  if (args.version) {
    return console.log(version);
  }
  if (args.help) {
    return help();
  }

  const entry = source ? path.resolve(cwd, source) : '';
  const { bundle } = require(".");

  try {
    return await bundle(entry, outputConfig);
  } catch (err: any) {
    if (err.name === 'NOT_EXISTED') {
      help();
      return exit(err);
    }
    throw err;
  }
}

async function main() {
  let params, error;
  try {
    params = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    error = err;
  }
  if (error || !params) {
    if (!error) help();
    return exit(error as Error);
  }
  await run(params);
}

main().catch(exit);
