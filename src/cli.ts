import fs from "fs";
import path from "path";
import program from "commander";
import { CliArgs } from "./types";

program
  .name("bunchee")
  .version(require('../package.json').version, "-v, --version")
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
  const entry = path.resolve(process.cwd(), entryFilePath);
  if (!fs.existsSync(entry)) {
    return help();
  }

  await eval(`require('.')`)(entry, outputConfig);
}

function help() {
  program.help();
}
