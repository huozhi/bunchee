# bunchee

> zero config bundler for JavaScript/TypeScript/JSX library

![bunchee](https://repository-images.githubusercontent.com/154026156/5d132698-0ff5-4644-a4fd-d9570e6229bc)

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

Create your library

```sh
cd ./my-lib && mkdir src
touch ./src/index.ts
touch package.json
```

Configure module exports

[exports sugar in Node.js](https://nodejs.org/api/packages.html#exports-sugar)

You can use the `exports` field to support different conditions and leverage the same functionality as other bundlers, such as webpack. The exports field allows you to define multiple conditions.

```json
{
  "exports": {
    "import": "dist/index.mjs",
    "require": "dist/index.cjs"
  },
  "scripts": {
    "build": "bunchee"
  }
}
```

Using pure ESM package?

```json
{
  "type": "module",
  "main": "./dist/index.mjs",
  "scripts": {
    "build": "bunchee"
  }
}
```

Then just run `npm run build`, or `pnpm build` / `yarn build` if you're using these package managers. The output format will based on the exports condition and also the file extension. Given an example:

- It's CommonJS for `require` and ESM for `import` based on the exports condition.
- It's CommonJS for `.js` and ESM for `.mjs` based on the extension regardless the exports condition. Then for export condition like "node" you could choose the format with your extension.

## Configuration

`bunchee` CLI provides few options to create different bundles or generating types.

### CLI Options

- Output (`-o <file>`): Specify output filename.
- Format (`-f <format>`): Set output format (default: `'esm'`).
- External (`--external <dep,>`): Specifying extra external dependencies, by default it is the list of `dependencies` and `peerDependencies` from `package.json`. Values are separate by comma.
- Target (`--target <target>`): Set ECMAScript target (default: `'es2016'`).
- Runtime (`--runtime <runtime>`): Set build runtime (default: `'browser'`).
- Environment (`--env <env,>`): Define environment variables. (default: `NODE_ENV`, separate by comma)
- Working Directory (`--cwd <cwd>`): Set current working directory where containing `package.json`.
- Types (`--dts`): Generate TypeScript declaration files along with assets.
- Minify (`-m`): Compress output.
- Watch (`-w`): Watch for source file changes.

### Basic Example

```sh
cd <project-root-dir>

# specifying input, output and format

bunchee ./src/index.js -f cjs -o ./dist/bundle.js
bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js

# build node.js library, or change target to es2019
bunchee ./src/index.js --runtime node --target es2019
```

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

### Entry Files Convention

While `exports` field is becoming the standard of exporting in node.js, bunchee also supports to build multiple exports all in one command.

What you need to do is just add an entry file with the name (`[name].[ext]`) that matches the exported name from exports field in package.json. For instance:

- `<cwd>/src/index.ts` will match `"."` export name or the if there's only one main export.
- `<cwd>/src/lite.ts` will match `"./lite"` export name.

The build script will be simplified to just `bunchee` in package.json without configure any input sources for each exports. Of course you can still specify other arguments as you need.

Assuming you have default export package as `"."` and subpath export `"./lite"` with different exports condition listed in package.json

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
- my-lib/
  |- src/
    |- lite.ts
    |- index.ts
  |- package.json
```

It will also look up for `index.<ext>` file under the directory having the name of the export path. For example, if you have `"./lite": "./dist/lite.js"` in exports field, then it will look up for `./lite/index.js` as the entry file as well.

### Special Exports Conventions

For exports condition like `react-native`, `react-server` and `edge-light` as they're special platforms, they could have different exports or different code conditions. In this case bunchee provides an override input source file convention if you want to build them as different code bundle.

For instance:

```json
{
  "exports": {
    "react-server": "./dist/react-server.mjs",
    "edge-light": "./dist/edge-light.mjs",
    "import": "./dist/index.mjs"
  }
}
```

You can use `index.<export-type>.<ext>` to override the input source file for specific export name. Or using `<export-path>/index.<export-type>.<ext>` also works. Such as:

```
|- src/
  |- index/.ts
  |- index.react-server.ts
  |- index.edge-light.ts
```

This will match the export name `"react-server"` and `"edge-light"` then use the corresponding input source file to build the bundle.

#### Package lint

`bunchee` has support for checking the package bundles are matched with package exports configuration.

### Wildcard Exports (Experimental)

Bunchee implements the Node.js feature of using the asterisk `*` as a wildcard to match the exportable entry files.

For example:

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./*": {
      "import": "./dist/*.mjs",
      "require": "./dist/*.cjs"
    }
  }
}
```

The asterisk `*`  will be replaced with your entry files, such as:

```
- my-lib/
  |- src/
    |- foo/
      |- index.ts
    |- bar.ts
    |- index.ts
  |- package.json
```

This will match the export names `"foo"` and `"bar"` and will be treated as the new entries as they matched the `./*` wildcard in `my-lib` folder.

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./foo": {
      "import": "./dist/foo/index.mjs",
      "require": "./dist/foo/index.cjs"
    },
    "./bar": {
      "import": "./dist/bar.mjs",
      "require": "./dist/bar.cjs"
    }
  }
}
```

> Note:  Wildcard Exports currently only supports the exports key `"./*"`, which will match all the available entries.

### CSS

`bunchee`` has basic CSS support for pure CSS file imports. It will be bundled into js bundle and insert the style tag into the document head when the bundle is loaded by browser.

```css
/* src/style.css */
.foo { color: orange; }
```

```tsx
// src/index.tsx
import './style.css'

export const Foo = () => <div className="foo">foo</div>
```

### TypeScript

By default bunchee includes Typescript v3.9.x inside as a dependency. If you want to use your own version, just install typescript as another dev dependency then bunchee will automatically pick it.

```sh
npm i -D bunchee typescript
```

Create `tsconfig.json` to specify any compiler options for TypeScript.

This library requires at least TypeScript 4.1.x.

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
