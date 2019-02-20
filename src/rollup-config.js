const path = require('path');
const babel = require('rollup-plugin-babel');
const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const nodeResolve = require('rollup-plugin-node-resolve');
const config = require('./config');

const defaultInput = path.resolve(config.rootDir, 'src', 'index.js');
const mainFieldsConfig = [
  {field: 'main', format: 'cjs'},
  {field: 'module', format: 'esm'},
];

function createInputConfig(entry, package) {
  const externals = [
    package.peerDependencies,
    package.dependencies,
  ].filter(Boolean).map(Object.keys).reduce((a, b) => a.concat(b), []);

  return {
    input: entry,
    external: externals,
    plugins: [
      nodeResolve({
        preferBuiltins: false,
      }),
      commonjs({
        include: /node_modules\//,
      }),
      json(),
      babel({
        exclude: 'node_modules/**',
      }),
    ],
  };
}

function createOutputOptions(config, package) {
  return {
    name: package.name,
    format: config.format,
    file: package[config.field],
    esModule: false,
    strict: false,
  };
}

function createRollupConfig({
  package,
  entry = defaultInput
}) {
  const inputOptions = createInputConfig(entry, package);
  const outputsOptions = mainFieldsConfig
    .filter(config => Boolean(package[config.field]))
    .map(config => createOutputOptions(config, package));

  return {
    input: inputOptions,
    outputs: outputsOptions,
  };
}

module.exports = createRollupConfig;
