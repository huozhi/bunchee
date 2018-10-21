const babel = require('rollup-plugin-babel');
const cjs = require('rollup-plugin-commonjs');
const resolve = require('rollup-plugin-node-resolve');
const utils = require('./utils');

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

function createRollupConfig({entry, package, babelConfig = {}}) {
  const inputOptions = createInputConfig({entry, babelConfig});
  const outputOptions = createOutputOptions({package});

  return {
    inputOptions,
    outputOptions,
  };
}

module.exports = createRollupConfig;
