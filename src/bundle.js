const rollup = require('rollup');
const createRollupConfig = require('./rollup-config');
const utils = require('./utils');

function createBundle(entry, options = {}) {
  const package = utils.getPackageMeta();
  const rollupConfig = createRollupConfig(entry, package, options);

  if (options.watch) {
    return watch(rollupConfig);
  }
  return bundle(rollupConfig);
}

function watch({input, outputs}) {
  const watchOptions = {
    ...input,
    output: outputs,
    watch: {
      exclude: 'node_modules/**'
    }
  };
  return rollup.watch(watchOptions);
}

function bundle({input, outputs}) {
  return rollup.rollup(input)
    .then(
      bundle => {
        const wirteJobs = outputs.map(options => bundle.write(options));
        return Promise.all(wirteJobs)
      },
      error => {
        console.log(error)
        console.error(error.snippet); // logging source code in format
      }
    );
}

module.exports = createBundle;
