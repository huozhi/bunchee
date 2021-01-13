import path from "path";
import config from "./config";
import type { PackageMetadata } from "./types";

function getPackageMeta(): PackageMetadata {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  let targetPackageJson;
  try {
    targetPackageJson = require(pkgFilePath);
  } catch (e) {
    targetPackageJson = {}
  }
  const {name, main, module, dependencies, peerDependencies} = targetPackageJson;

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
