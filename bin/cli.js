#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const commander = require('commander');
const bundle = require('../src/bundle');
const pkg = require('../package.json');
const config = require('../src/config');

const args = process.argv;

function run(entryFilePath) {
  const entry = path.resolve(config.rootDir, entryFilePath);
  if (!fs.existsSync(entry)) {
    console.log('entry file not exsited!');
    return;
  }
  bundle(entry)
};


commander
  .version(pkg.version, '-v, --version')
  .action(run);

commander.parse(args);
