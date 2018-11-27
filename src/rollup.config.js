const path = require('path');
const babel = require('rollup-plugin-babel');
const cjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const resolve = require('rollup-plugin-node-resolve');
const config = require('./config');

const defaultInput = path.resolve(config.rootDir, 'src', 'index.js');
const mainFieldsConfig = [
  {field: 'main', format: 'umd'}, 
  {field: 'module', format: 'esm'},
];

function createInputConfig(entry, babelConfig) {
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
      json(),
      resolve(),
    ],
  };
}

function createOutputOptions(config, package) {
  return {
    name: package.name,
    format: config.format,
    file: package[config.field],
    exports: 'named',
  };
}

function createRollupConfig({
  package,
  entry = defaultInput,
  babelConfig = {}
}) {
  const inputOptions = createInputConfig(entry, babelConfig);
  const outputsOptions = mainFieldsConfig
    .filter(config => Boolean(package[config.field]))
    .map(config => createOutputOptions(config, package));

  return {
    input: inputOptions,
    outputs: outputsOptions,
  };
}

module.exports = createRollupConfig;
