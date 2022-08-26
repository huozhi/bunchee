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

Bunchee can help you to bundle your library into one file with zero configuration. It's built on top of rollup.

Let you focus on writing code and can generate multiple types of module (CommonJS, ESModules) at the same time.


## Installation

```sh
npm install --save-dev bunchee
```

## Usage
### Basic

Declare your main field and module field in package.json, then call bunchee cli in build scripts. If you're using typescript, types will be generated automatically based on your package.json field `typings` or `types`.


* `main` + `module`

You can have Commonjs + ESModules output as the simple config

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

* `exports` [sugar](https://nodejs.org/api/packages.html#exports-sugar)

Leverage `exports` field to support different conditions would be also ideal. Most of the bundler such as `webpack` can already handle the [`package exports`](https://webpack.js.org/guides/package-exports/) well. It's convenient to define multiple conditions in exports.

```json
{
  "exports": {
    "require": "dist/index.cjs",
    "import": "dist/index.mjs",
    "module": "dist/index.esm.js" // module condition
  },
  "scripts": {
    "build": "bunchee ./src/index.js"
  },
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
  -f, --format <format>  specify bundle type: "esm", "cjs", "umd". "esm" by default
  -e, --external <mod>   specify an external dependency
  -h, --help             output usage information
  --target <target>      build environment, use "node" for nodejs runtime
  --sourcemap            enable sourcemap generation, sourcemap generation is disabled by default
  --cwd <cwd>            specify current working directory

Usage:
  $ bunchee ./src/index.js # if you set main fields in package.json
  $ bunchee ./src/index.ts -o ./dist/bundle.js # specify the dist file path
```

### API

```js
import { bundle } from 'bunchee'

// options is same to CLI options
await bundle(entryFilePath, options)
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

By default bunchee includes Typescript v3.9.x inside as a dependency. If you want to use your own version, just install typescript as another dev dependency then bunchee will automatically pick it.

```sh
yarn add -D bunchee typescript
```

This library requires at least [TypeScript 3.7](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html).
