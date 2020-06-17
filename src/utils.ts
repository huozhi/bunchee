import path from "path";
import config from "./config";
import { PackageMetadata } from "./types";
import pkg from "./pkg";

function getPackageMeta(): PackageMetadata {
  const { name, main, module, dependencies, peerDependencies } = pkg;

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
