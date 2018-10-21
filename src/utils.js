const path = require('path');
const config = require('./config');

function getPackageMeta() {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  // TODO: safe require
  const pkgJSON = require(pkgFilePath);
  const {name, main, module} = pkgJSON;

  return {
    name,
    main,
    module, // TODO: bundle module field for esnext
    input: path.resolve(config.rootDir, 'src', 'index.js'),
  }
}

function resolvePackagePath(path) {
  return path.resolve(config.rootDir, path);
}

module.exports = {
  getPackageMeta,
  resolvePackagePath,
};
