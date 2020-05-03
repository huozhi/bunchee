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
  -v, --version        output the version number
  -w, --watch          watch src files changes
  -o, --output <file>  specify output filename
  -h, --help           output usage information

Usage:
  $ bunchee ./src/index.js
```

### Dev Dependency

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

Or use it with CLI to specifiy the output filename

```sh
cd <project-root-dir>
bunchee ./src/index.js -o ./dist/bundle.js
```
