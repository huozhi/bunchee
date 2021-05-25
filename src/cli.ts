#!/usr/bin/env node

import fs from "fs";
import path from "path";
import arg from "arg";
import { CliArgs } from "./types";

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


// program
//   .name("bunchee")
//   .version(require('../package.json').version, "-v, --version")
//   .option("-w, --watch", "watch src files changes")
//   .option("-o, --output <file>", "specify output filename")
//   .option("-f, --format <format>", "specify output file format")
//   .option("-m, --minify", "compress output")
//   .option("--cwd <cwd>", "specify current working directory")
//   .option("--no-sourcemap", "disable sourcemap")
//   .action(run);

// program.parse(process.argv);

async function main() {
  const argv = arg({
    '-w, --watch': Boolean,
    '-o, --output': String,
    '-f, --format': String,
    '-m, --minify': String,
    '--cwd': String,
    '--no-sourcemap': String,
  })
  
}

async function run(entryFilePath: string) {
  const { format, output: file, watch, minify, cwd, sourcemap } = program;
  const outputConfig: CliArgs = {
    file,
    format,
    cwd,
    watch: watch,
    minify: !!minify,
    sourcemap: sourcemap === false ? false : true,
  };
  if (typeof entryFilePath !== "string") {
    return help();
  }
  const entry = path.resolve(cwd || process.cwd(), entryFilePath);
  if (!fs.existsSync(entry)) {
    return help();
  }

  const { bundle } = require('.')
  
  try {
    await bundle(entry, outputConfig);
  } catch (e) {
    console.error(e)
    process.exit(2)
  }
}

