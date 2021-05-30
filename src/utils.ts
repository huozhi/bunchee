import arg from "arg";
import path from "path";
import config from "./config";
import { PackageMetadata } from "./types";

function getPackageMeta(): PackageMetadata {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  let targetPackageJson;
  try {
    targetPackageJson = require(pkgFilePath);
  } catch (e) {
    targetPackageJson = {}
  }
  const {
    name, 
    main, 
    module, 
    dependencies, 
    peerDependencies,
    types,
    typings,
  } = targetPackageJson;

  return {
    name,
    main,
    module,
    dependencies,
    peerDependencies,
    types,
    typings,
  };
}

function resolvePackagePath(pathname: string): string {
  return path.resolve(config.rootDir, pathname);
}

export function parseCliArgs(argv: string[]) {
  let args: arg.Result<any> | undefined
  args = arg({
    "--watch": Boolean,
    "--output": String,
    "--format": String,
    "--minify": Boolean,
    "--cwd": String,
    "--no-sourcemap": Boolean,
    
    "-w": "--watch",
    "-o": "--output",
    "-f": "--format",
    "-m": "--minify",
  }, {permissive: true, argv}) 
  const source: string = args._[0]
  const parmas = {
    source,
    format: args["--format"], 
    file: args["--output"], 
    watch: args["--watch"], 
    minify: args["--minify"], 
    sourcemap: args["--no-sourcemap"] !== true,
    cwd: args["--cwd"], 
  }
  return parmas;
}


export default {
  getPackageMeta,
  resolvePackagePath,
};
