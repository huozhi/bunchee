import fs from "fs";
import arg from "arg";
import path from "path";
import config from "./config";
import { PackageMetadata } from "./types";

function getPackageMeta(): PackageMetadata {
  const pkgFilePath = path.resolve(config.rootDir, 'package.json');
  let targetPackageJson;
  try {
    targetPackageJson = JSON.parse(fs.readFileSync(pkgFilePath, { encoding: 'utf-8' }));
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
  let args: arg.Result<any> | undefined;
  args = arg({
    "--cwd": String,
    "--output": String,
    "--format": String,
    "--watch": Boolean,
    "--minify": Boolean,
    "--help": Boolean,
    "--version": Boolean,
    "--target": String,
    "--no-sourcemap": Boolean,
    
    "-h": "--help",
    "-v": "--version",
    "-w": "--watch",
    "-o": "--output",
    "-f": "--format",
    "-m": "--minify",
  }, {
    permissive: true, 
    argv
  });
  const source: string = args._[0];
  const parsedArgs = {
    source,
    format: args["--format"], 
    file: args["--output"], 
    watch: args["--watch"], 
    minify: args["--minify"], 
    sourcemap: args["--no-sourcemap"] !== true,
    cwd: args["--cwd"],
    help: args["--help"],
    version: args["--version"],
    target: args["--target"],
  }
  return parsedArgs;
}


export default {
  getPackageMeta,
  resolvePackagePath,
};
