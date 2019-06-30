const commonjs = require('rollup-plugin-commonjs');
const json = require('rollup-plugin-json');
const buble = require('rollup-plugin-buble');
const nodeResolve = require('rollup-plugin-node-resolve');

const mainFieldsConfig = [
  {field: 'main', format: 'cjs'},
  {field: 'module', format: 'esm'},
];

function createInputConfig(entry, package, options) {
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
      buble({
        exclude: 'node_modules/**',
        jsx: options.jsx,
        objectAssign: 'Object.assign',
        transforms: {
          dangerousForOf: true,
          dangerousTaggedTemplateString: true,
        },
      }),
    ],
  };
}

function createOutputOptions(config, package, options) {
  return {
    name: package.name,
    format: config.format,
    file: options.dest || package[config.field],
    esModule: false,
    strict: false,
  };
}

function createRollupConfig(
  entry,
  package,
  options
) {
  const inputOptions = createInputConfig(entry, package, options);
  const outputsOptions = mainFieldsConfig
    .filter(config => Boolean(package[config.field]))
    .map(config => createOutputOptions(config, package, options));

  return {
    input: inputOptions,
    outputs: outputsOptions,
  };
}

module.exports = createRollupConfig;
