const rollup = require('rollup');
const createBabelConfig = require('./babel.config');
const createRollupConfig = require('./rollup.config');
const utils = require('./utils');

function createBundle(entry) {
  const package = utils.getPackageMeta();
  const babelConfig = createBabelConfig();
  const rollupConfig = createRollupConfig({entry, package, babelConfig});

  return rollup.rollup(rollupConfig.input)
    .then(bundle => {
      const wirteJobs = rollupConfig.outputs.map(options => bundle.write(options));
      return Promise.all(wirteJobs)
    })
}

module.exports = createBundle;
