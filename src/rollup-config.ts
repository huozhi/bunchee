const commonjs = require('@rollup/plugin-commonjs');
const json = require('@rollup/plugin-json');
const buble = require('@rollup/plugin-buble');
const nodeResolve = require('@rollup/plugin-node-resolve');

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

function createOutputOptions(file, format, package) {
  return {
    name: package.name,
    file,
    format,
    esModule: format !== 'umd',
    freeze: false,
    strict: false,
    sourcemap: true,
  };
}

function createRollupConfig(
  entry,
  package,
  options = {}
) {
  const {file, format = 'esm', jsx} = options;
  const inputOptions = createInputConfig(entry, package, {jsx});
  
  let outputConfigs = mainFieldsConfig
    .filter(config => Boolean(package[config.field]))
    .map(config => {
      const filename = package[config.field];
      return createOutputOptions(filename, config.format, package);
    });
  
  // CLI output option is always prioritized
  if (file) {
    outputConfigs = [createOutputOptions(file, format, package)];
  }

  return {
    input: inputOptions,
    outputs: outputConfigs,
    treeshake: {
      propertyReadSideEffects: false,
    },
  };
}

module.exports = createRollupConfig;
