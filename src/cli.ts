#!/usr/bin/env node

import fs from "fs";
import path from "path";
import program from "commander";
import type { CliArgs } from "./types";

program
  .name("bunchee")
  .version(require('../package.json').version, "-v, --version")
  .option("-w, --watch", "watch src files changes")
  .option("-o, --output <file>", "specify output filename")
  .option("-f, --format <format>", "specify output file format")
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
  const entry = path.resolve(process.cwd(), entryFilePath);
  if (!fs.existsSync(entry)) {
    return help();
  }

  // TODO: let it resolve easier with both ts-node and nodejs
  const module = require('.')
  const bunchee = module.default ? module.default : module 
  
  try {
    // @ts-ignore 
    await bunchee(entry, outputConfig);
  } catch (e) {
    console.error(e)
    process.exit(2)
  }
}

function help() {
  program.help();
}
