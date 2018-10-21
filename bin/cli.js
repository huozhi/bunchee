#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const commander = require('commander');
const bundle = require('../src/bundle');
const pkg = require('../package.json');
const config = require('../src/config');

const args = process.argv;

function run(main) {
  const entryPath = path.resolve(config.rootDir, main);
  if (!fs.existsSync(entryPath)) {
    console.log('entry file not exsited!');
    return;
  }
  bundle(entryPath)
};


commander
  .version(pkg.version, '-v, --version')
  .action(run);

commander.parse(args);
