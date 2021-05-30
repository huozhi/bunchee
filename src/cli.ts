#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { CliArgs } from "./types";
import { parseCliArgs } from "./utils";
import { version } from "../package.json";

const helpMessage = `
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -o, --output <file>    specify output filename
  -f, --format <format>  specify output file format
  -m, --minify           compress output
  --cwd <cwd>            specify current working directory
  --no-sourcemap         disable sourcemap
  -h, --help             output usage information
`

function help() {
  console.log(helpMessage);
}

function exit(error: Error) {
  console.error(error);
  process.exit(2);
}

async function run(args: any) {
  const { source, format, file, watch, minify, cwd, sourcemap } = args;
  const outputConfig: CliArgs = {
    file,
    format,
    cwd,
    watch: watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
  };
  if (args.version) {
    return console.log(version);
  }
  if (args.help || !source) {
    return help();
  }

  const entry = path.resolve(cwd || process.cwd(), source);
  
  if (!fs.existsSync(entry) || !fs.statSync(entry).isFile()) {
    const err = new Error('Entry file is not existed');
    help();
    return exit(err);
  }

  const { bundle } = require(".")
  
  return await bundle(entry, outputConfig);
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
    return exit(error);
  }
  await run(params);
}

main().catch(exit);
