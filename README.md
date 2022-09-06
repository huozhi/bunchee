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

Bunchee can help you to bundle your library into one file with zero configuration. It's built on top of rollup and SWC ⚡️.

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
    "module": "dist/index.esm.js"
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
  --target <target>      js features target: swc target es versions. "es5" by default
  --runtime <runtime>    build runtime: "nodejs", "browser". "browser" by default
  --cwd <cwd>            specify current working directory
  --sourcemap            enable sourcemap generation, false by default
  --dts                  determine if need to generate types, false by default

Usage:
  $ bunchee ./src/index.js # if you set main fields in package.json
  $ bunchee ./src/index.ts -o ./dist/bundle.js # specify the dist file path
```

Run bunchee via CLI

```sh
cd <project-root-dir>
bunchee ./src/index.js -f cjs -o ./dist/bundle.js

bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js
# if you don't specify format type, default format is ESModule
# bunchee ./src/index.js -o ./dist/bundle.esm.js
```

### Node.js API

```js
import { bundle } from 'bunchee'

// options is same to CLI options
await bundle(entryFilePath, options)
```

### Typescript

By default bunchee includes Typescript v3.9.x inside as a dependency. If you want to use your own version, just install typescript as another dev dependency then bunchee will automatically pick it.

```sh
yarn add -D bunchee typescript
```

Create `tsconfig.json` to specify any compiler options for TypeScript.

This library requires at least [TypeScript 3.7](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html).


## Advanced

### Multiple Exports

While `exports` filed is becoming the standard of exporting in node.js, bunchee also supports to build multiple exports all in one command.

What you need to do is just add an entry file with the name (`[name].[ext]`) that matches the exported name from exports field in package.json. For instance:

* `index.ts` will match `"."` export name or the if there's only one main export.
* `lite.ts` will match `"./lite"` export name.

The build script will be simplified to just `bunchee` in package.json without configure any input sources for each exports. Of course you can still specify other arguments as you need.

#### How it works

Assuming you have main entry export `"."` and subpath export `"./lite"` with different exports condition listed in package.json

```json
{
  "name": "example",
  "scripts": {
     "build": "bunchee"
  },
  "exports": {
    "./lite": "./dist/lite.js"
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
   }
  }
}
```

Then you need to add two entry files `index.ts` and `lite.ts` in project root directory to match the export name `"."` and `"./lite"`, bunchee will associate these entry files with export names then use them as input source and output paths information.

```
- example/
  |- lite.ts
  |- index.ts
  |- src/
  |- package.json
```

### License

MIT
