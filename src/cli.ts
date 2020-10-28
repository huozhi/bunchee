#!/usr/bin/env node

import fs from "fs";
import path from "path";
import program from "commander";
import config from "./config";
import pkg from "./pkg";
import bunchee from "./index";
import { CliArgs } from "./types";

program
  .name("bunchee")
  .version(pkg.version, "-v, --version")
  .option("-w, --watch", "watch src files changes")
  .option("-o, --output <file>", "specify output filename")
  .option("-f, --format <format>", "specify output file format")
  .option("-b, --bin", "output with shebang as banner at top")
  .action(run);

program.parse(process.argv);

async function run(entryFilePath: string) {
  const { format, output: file, bin, watch } = program;
  const outputConfig: CliArgs = {
    file,
    format,
    watch: !!watch,
    shebang: !!bin,
  };
  if (typeof entryFilePath !== "string") {
    return help();
  }
  const entry = path.resolve(config.rootDir, entryFilePath);
  if (!fs.existsSync(entry)) {
    return help();
  }
  await bunchee(entry, outputConfig);
}

function help() {
  program.help();
}
