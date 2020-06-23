import path from "path";
import config from "./config";
import { PackageMetadata } from "./types";

function getPackageMeta(): PackageMetadata {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  let pkg;
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
  };
}

function resolvePackagePath(pathname: string): string {
  return path.resolve(config.rootDir, pathname);
}

export default {
  getPackageMeta,
  resolvePackagePath,
};
