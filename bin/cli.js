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
  .option('--jsx <jsx>', 'jsx function for creating element')
  .option('--cjs <filename>', 'specify Commonjs output filename')
  .option('--esm <filename>', 'specify ESModule output filename')
  .option('--umd <filename>', 'specify UMD output filename')
  .action(run);

program.parse(process.argv);

function run(entryFilePath) {
  const {cjs, esm, umd} = program;
  const outputConfig = {
    output: {
      cjs,
      esm,
      umd,
    },
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
