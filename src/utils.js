const path = require('path');
const config = require('./config');

function getPackageMeta() {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  let pkg
  try {
    pkg = require(pkgFilePath);
  } catch (e) {
    pkg = {}
  }
  const {name, main, module, dependencies, peerDependencies} = pkg;

  return {
    name,
    main,
    module,
    dependencies,
    peerDependencies,
  }
}

function resolvePackagePath(path) {
  return path.resolve(config.rootDir, path);
}

module.exports = {
  getPackageMeta,
  resolvePackagePath,
};
