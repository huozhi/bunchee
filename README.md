# bunchee
> zero config bundler for JavaScript/TypeScript/JSX library

![bunchee](https://user-images.githubusercontent.com/4800338/98430015-7ce64f00-20e5-11eb-8c64-41addfbd4ede.png) 

<p align="left">
  <a href="https://npm.im/bunchee">
    <img src="https://badgen.net/npm/v/bunchee">
  </a>
  
  <a href="https://github.com/huozhi/bunchee/actions?workflow=CI">
    <img src="https://github.com/huozhi/bunchee/workflows/CI/badge.svg">
  </a>
</p>

Bunchee can help you to bundle your library into one file with zero configuration. It's built on top of rollup and babel.
Let you focus on writing code and can generate multiple types of module (commonjs, esmodule) at the same time.


## Installation

```sh
npm install --save-dev bunchee
```

## Usage
### Basic

Declare your main field and module field in package.json, then call bunchee cli in build scripts. If you're using typescript, types will be generated automatically based on your package.json field `typings` or `types`.

```json
{
  "main": "dist/pkg.cjs.js",
  "module": "dist/pkg.esm.js",
  "scripts": {
    "build": "bunchee ./src/index.js"
  },
  "types": "dist/types/index.d.ts"
}
```

### CLI

```
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -m, --minify           compress output. false by default
  -o, --output <file>    specify output filename
  -f, --format <format>  specify bundle type. esm, cjs, umd. "esm" by default
  -h, --help             output usage information
  --no-sourcemap         disable sourcemap generation, sourcemap generation is enabled by default
  --cwd <cwd>            specify current working directory

Usage:
  $ bunchee ./src/index.js # if you set main fields in package.json
  $ bunchee ./src/index.ts -o ./dist/bundle.js # specify the dist file path
```

#### Example Scripts

```sh
cd <project-root-dir>
bunchee ./src/index.js -f cjs -o ./dist/bundle.js

bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js
# if you don't specify format type, default format is ESModule
# bunchee ./src/index.js -o ./dist/bundle.esm.js
```

### Using Typescript

This library requires at least [TypeScript 3.7](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html).
