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

Bunchee makes bundling your library into one file effortless, with zero configuration required. It is built on top of Rollup and SWC ⚡️, allowing you to focus on writing code and generating multiple module types (CommonJS, ESModules) simultaneously.

## Installation

```sh
npm install --save-dev bunchee
```

## Usage
### Package.json Configuration

Declare the main and module fields in your package.json file, then call the bunchee CLI in the build scripts. If you are using TypeScript, types will be generated automatically based on the typings or types field in your package.json file.


### Create your entry file

```sh
cd ./my-lib
touch ./index.js
```
### Configure module exports

[exports sugar in Node.js](https://nodejs.org/api/packages.html#exports-sugar)

You can use the `exports` field to support different conditions and leverage the same functionality as other bundlers, such as webpack. The exports field allows you to define multiple conditions.


```json
{
  "exports": {
    "require": "dist/index.cjs",
    "import": "dist/index.mjs",
    "module": "dist/index.esm.js"
  },
  "scripts": {
    "build": "bunchee"
  },
}
```

Using pure ESM package?

```json
{
  "type": "module",
  "main": "./dist/index.js",
  "scripts": {
    "build": "bunchee"
  }
}
```

Or you can use `main` and `module` fields. `bunchee` supports legacy package exports configuration field `module` field for exporting esm assets at the same time.

```json
{
  "main": "dist/pkg.cjs.js",
  "module": "dist/pkg.esm.js",
  "scripts": {
    "build": "bunchee"
  },
}
```

Then just run `npm run build`, or `pnpm build` / `yarn build` if you're using these package managers.

### CLI

Run bunchee via CLI

```sh
cd <project-root-dir>
bunchee ./src/index.js -f cjs -o ./dist/bundle.js

bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js
```


## Configurations

- Output (`-o <file>`): Specify output filename.
- Format (`-f <format>`): Set output format (default: `'esm'`).
- External (`--external <dep,>`): Specifying extra external dependencies, by default it is the list of `dependencies` and `peerDependencies` from `package.json`. Values are separate by comma.
- Target (`--target <target>`): Set ECMAScript target (default: `'es2016'`).
- Runtime (`--runtime <runtime>`): Set build runtime (default: `'browser'`).
- Environment (`--env <env,>`): Define environment variables. (default: `NODE_ENV`, separate by comma)
- Working Directory (`--cwd <cwd>`): Set current working directory.
- Minify (`-m`): Compress output.
- Watch (`-w`): Watch for source file changes.
- TS Types: Generate TypeScript declaration files. (use `--dts` to enable).


## Entry Files Convention

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

### Externals

#### Specifying extra external dependencies

If you want to mark specific dependencies as external and not include them in the bundle, use the `--external` option followed by a comma-separated list of dependency names:

```sh
bunchee --external=dependency1,dependency2,dependency3
```

Replace `dependency1`, `dependency2`, and `dependency3` with the names of the dependencies you want to exclude from the bundle.

#### Bundling everything without external dependencies
To bundle your library without external dependencies, use the `--no-external` option:

```sh
bunchee --no-external
```
This will include all dependencies within your output bundle.

### Environment Variables
To pass environment variables to your bundled code, use the --env option followed by a comma-separated list of environment variable names:

```bash
bunchee --env=ENV1,ENV2,ENV3
```

Replace `ENV1`, `ENV2`, and `ENV3` with the names of the environment variables you want to include in your bundled code. These environment variables will be inlined during the bundling process.

### Package lint

`bunchee` has support for checking the package bundles are matched with package exports configuration.

### TypeScript

By default bunchee includes Typescript v3.9.x inside as a dependency. If you want to use your own version, just install typescript as another dev dependency then bunchee will automatically pick it.

```sh
yarn add -D bunchee typescript
```

Create `tsconfig.json` to specify any compiler options for TypeScript.

This library requires at least [TypeScript 3.7](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html).


Adding `"types"` or `"typing"` field in your package.json, types will be generated with that path.

```json
{
  "types": "dist/types/index.d.ts"
}
```

### Node.js API

```ts
import path from 'path'
import { bundle, type BundleConfig } from 'bunchee'

// The definition of these options can be found in help information
await bundle(path.resolve('./src/index.ts'), {
  dts: false, // Boolean
  watch: false, // Boolean
  minify: false, // Boolean
  sourcemap: false, // Boolean
  external: [], // string[]
  format: 'esm', // 'esm' | 'cjs'
  target: 'es2016', // ES syntax target
  runtime: 'nodejs', // 'browser' | 'nodejs'
  cwd: process.cwd(), // string
})
```

#### Watch Mode

Bunchee offers a convenient watch mode for rebuilding your library whenever changes are made to the source files. To enable this feature, use either -w or --watch.

#### `target`

If you specify `target` option in `tsconfig.json`, then you don't have to pass it again through CLI.

### License

MIT
