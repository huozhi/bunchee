const rollup = require('rollup');
const createRollupConfig = require('./rollup-config');
const utils = require('./utils');

function createBundle(entry) {
  const package = utils.getPackageMeta();
  const rollupConfig = createRollupConfig({entry, package});

  return rollup.rollup(rollupConfig.input)
    .then(
      bundle => {
        const wirteJobs = rollupConfig.outputs.map(options => bundle.write(options));
        return Promise.all(wirteJobs)
      },
      error => {
        console.error(error);
      }
    );
}

module.exports = createBundle;
