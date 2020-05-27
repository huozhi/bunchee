#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const bundle = require('../src/bundle');
const pkg = require('../package.json');
const config = require('../src/config');

program
  .name('bunchee')
  .version(pkg.version, '-v, --version')
  .option('-w, --watch', 'watch src files changes')
  .option('-o --output <file>', 'specify output filename')
  .option('--jsx <jsx>', 'jsx function for creating element')
  .option('--format <format>', 'specify output file format')
  .action(run);

program.parse(process.argv);

function run(entryFilePath) {
  const {format, output: file} = program;
  const outputConfig = {
    file,
    format,
    watch: !!program.watch,
    jsx: program.jsx,
  };
  if (typeof entryFilePath !== 'string') {
    return help();
  }
  const entry = path.resolve(config.rootDir, entryFilePath);
  if (!fs.existsSync(entry)) {
    return help();
  }
  bundle(entry, outputConfig)
};

function help() {
  program.help();
}
