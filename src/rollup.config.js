const path = require('path');
const babel = require('rollup-plugin-babel');
const cjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');
const config = require('./config');

const defaultInput = path.resolve(config.rootDir, 'src', 'index.js');

function createInputConfig({entry, babelConfig}) {
  return {
    input: entry,
    plugins: [
      cjs(),
      babel({
        babelrc: false,
        configFile: false,
        presets: babelConfig.presets,
        plugins: babelConfig.plugins,
      }),
      resolve(),
    ],
  };
}

function createOutputOptions({package}) {
  return {
    format: 'umd',
    name: package.name,
    file: package.main,
  };
}

function createRollupConfig({
  package,
  entry = defaultInput,
  babelConfig = {}
}) {
  const outputOptions = createOutputOptions({package});
  const inputOptions = createInputConfig({entry, babelConfig});

  return {
    inputOptions,
    outputOptions,
  };
}

module.exports = createRollupConfig;
