#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const bundle = require('../src/bundle');
const pkg = require('../package.json');
const config = require('../src/config');

program.on('--help', function(){
  console.log('')
  console.log('Usage:');
  console.log('  $ bunchee ./src/index.js');
});

program
  .name('bunchee')
  .version(pkg.version, '-v, --version')
  .option('-w, --watch', 'watch src files changes')
  .option('-d, --dest <dir>', 'specify output dest file')
  .option('--jsx <jsx>', 'jsx function for creating element')
  .action(run);

program.parse(process.argv);

function run(entryFilePath) {
  const options = {
    dest: program.dest,
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
  bundle(entry, options)
};

function help() {
  program.help();
}
