# bunchee
> zero config bundler for ES6 syntax library

Bunchee can help you to bundle your code in ES6 syntax into one file with no configuration. It's built on top of rollup and buble.
Let you focus on writing code and can generate multiple types of module (commonjs, esmodule) at the same time.


## Installation

```sh
npm install --save-dev bunchee
```

## Usage

### CLI

```
Usage: bunchee [options]

Options:
  -v, --version          output the version number
  -w, --watch            watch src files changes
  -o, --output <file>    specify output filename
  -f, --format <format>  specify bundle type. esm, cjs, umd. default is esm
  -h, --help             output usage information

Usage:
  $ bunchee ./src/index.js
```

### Use NPM Script

Declare your main field and module field in package.json, then call bunchee cli in build scripts

```json
{
  "main": "dist/pkg.cjs.js",
  "module": "dist/pkg.esm.js",
  "scripts": {
    "build": "bunchee ./src/index.js"
  }
}
```

### Use CLI

```sh
cd <project-root-dir>
bunchee ./src/index.js -f cjs -o ./dist/bundle.js

bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js
# if you don't specify format type, default format is ESModule
# bunchee ./src/index.js -o ./dist/bundle.esm.js
```
