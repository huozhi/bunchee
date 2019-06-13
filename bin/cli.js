#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const program = require('commander');
const bundle = require('../src/bundle');
const pkg = require('../package.json');
const config = require('../src/config');

function run(entryFilePath, params = {}) {
  const options = {
    watch: params.watch
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

program.on('--help', function(){
  console.log('')
  console.log('Usage:');
  console.log('  $ bunchee ./src/index.js');
});

program
  .name('bunchee')
  .version(pkg.version, '-v, --version')
  .option('-w, --watch')
  .action(run);

program.parse(process.argv);
