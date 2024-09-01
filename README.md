# bunchee

> Zero-config bundler for JS/TS packages.

![bunchee](https://repository-images.githubusercontent.com/154026156/5d132698-0ff5-4644-a4fd-d9570e6229bc)

<p align="left">
  <a href="https://npm.im/bunchee">
    <img src="https://badgen.net/npm/v/bunchee">
  </a>

  <a href="https://github.com/huozhi/bunchee/actions?workflow=CI">
    <img src="https://github.com/huozhi/bunchee/workflows/CI/badge.svg">
  </a>
</p>

**bunchee** is a zero configuration bundler makes bundling JS/TS library effortless. It's built on top of Rollup and SWC ⚡️, allowing you to focus on writing code and generating multiple bundles (CommonJS or ESModule) at the same time.
It uses the standard exports configuration in `package.json` as the only source of truth, and uses entry file conventions to match your exports and build them into bundles.

## Quick Start

### Installation

```sh
npm install --save-dev bunchee
```

If you're using TypeScript

```sh
npm install --save-dev bunchee typescript
```

### Configuration

Create your library entry file and package.json.

```sh
cd ./my-lib
mkdir src && touch ./src/index.ts
```

#### Prepare

```sh
# Use bunchee to prepare package.json configuration
npm exec bunchee --prepare
# "If you're using other package manager such as pnpm"
# pnpm bunchee --prepare

# "Or use with npx"
# npx bunchee@latest --prepare
```

Or you can checkout the following cases to configure your package.json.

<details>
  <summary> JavaScript</summary>

Then use use the [exports field in package.json](https://nodejs.org/api/packages.html#exports-sugar) to configure different conditions and leverage the same functionality as other bundlers, such as webpack. The exports field allows you to define multiple conditions.

```json
{
  "files": ["dist"],
  "exports": {
    "import": "./dist/es/index.mjs",
    "require": "./dist/cjs/index.js"
  },
  "scripts": {
    "build": "bunchee"
  }
}
```

</details>

<details>
  <summary>TypeScript</summary>

If you're build a TypeScript library, separate the types from the main entry file and specify the types path in package.json. When you're using `.mjs` or `.cjs` extensions with TypeScript and modern module resolution (above node16), TypeScript will require specific type declaration files like `.d.mts` or `.d.cts` to match the extension. `bunchee` can automatically generate them to match the types to match the condition and extensions. One example is to configure your exports like this in package.json:

```json
{
  "files": ["dist"],
  "exports": {
    "import": {
      "types": "./dist/es/index.d.mts",
      "default": "./dist/es/index.mjs"
    },
    "require": {
      "types": "./dist/cjs/index.d.ts",
      "default": "./dist/cjs/index.js"
    }
  },
  "scripts": {
    "build": "bunchee"
  }
}
```

</details>

<details>
  <summary>Hybrid (CJS & ESM) Module Resolution with TypeScript</summary>
If you're using TypeScript with Node 10 and Node 16 module resolution, you can use the `types` field in package.json to specify the types path. Then `bunchee` will generate the types file with the same extension as the main entry file.

```json
{
  "files": ["dist"],
  "main": "./dist/cjs/index.js",
  "module": "./dist/es/index.mjs",
  "types": "./dist/cjs/index.d.ts",
  "exports": {
    "import": {
      "types": "./dist/es/index.d.ts",
      "default": "./dist/es/index.js"
    },
    "require": {
      "types": "./dist/cjs/index.d.cts",
      "default": "./dist/cjs/index.cjs"
    }
  },
  "scripts": {
    "build": "bunchee"
  }
}
```

</details>

#### Build

Then files in `src` folders will be treated as entry files and match the export names in package.json. For example:
`src/index.ts` will match the exports name `"."` or the only main export.

Now just run `npm run build` (or `pnpm build` / `yarn build`) if you're using these package managers, `bunchee` will find the entry files and build them.
The output format will based on the exports condition and also the file extension. Given an example:

- It's CommonJS for `require` and ESM for `import` based on the exports condition.
- It's CommonJS for `.js` and ESM for `.mjs` based on the extension regardless the exports condition. Then for export condition like "node" you could choose the format with your extension.

> [!NOTE]
> All the `dependencies` and `peerDependencies` will be marked as external automatically and not included in the bundle. If you want to include them in the bundle, you can use the `--no-external` option.

## Usage

### File Conventions

While `exports` field is becoming the standard of exporting in node.js, bunchee also supports to build multiple exports all in one command.

Provide entry files with the name (`[name].[ext]`) that matches the exported name from exports field in package.json. For instance:

- `<cwd>/src/index.ts` will match `"."` export name or the if there's only one main export.
- `<cwd>/src/lite.ts` will match `"./lite"` export name.

The build script can be just `bunchee` without configure any input sources for each exports. Of course you can still specify other arguments as you need.
Briefly, the entry files from `src/` folder will do matching with `exports` conditions from `package.json` and build them into bundles.

Assuming you have default export package as `"."` and subpath export `"./lite"` with different exports condition listed in package.json

```json
{
  "name": "example",
  "scripts": {
    "build": "bunchee"
  },
  "exports": {
    "./lite": "./dist/lite.js",
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

### Multiple Runtime

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

### Executables

To build executable files with the `bin` field in package.json, `bunchee` requires you to create the `bin` directory under `src` directory. The source file matching will be same as the entry files convention.

For example:

```bash
|- src/
  |- bin/
    |- index.ts
```

This will match the `bin` field in package.json as:

```json
{
  "bin": "./dist/bin.js"
}
```

For multiple executable files, you can create multiple files under the `bin` directory.

```bash
|- src/
  |- bin/
    |- foo.ts
    |- bar.ts
```

This will match the `bin` field in package.json as:

```json
{
  "bin": {
    "foo": "./dist/bin/a.js",
    "bar": "./dist/bin/b.js"
  }
}
```

> Note: For multiple `bin` files, the filename should match the key name in the `bin` field.

### Server Components

`bunchee` supports to build server components and server actions with library directives like `"use client"` or `"use server"`. It will generate the corresponding chunks for client and server that scope the client and server boundaries properly.
Then when the library is integrated to an app such as Next.js, app bundler can transform the client components and server actions correctly and maximum the benefits.

If you're using `"use client"` or `"use server"` in entry file, then it will be preserved on top and the dist file of that entry will become a client component.
If you're using `"use client"` or `"use server"` in a file that used as a dependency for an entry, then that file containing directives be split into a separate chunk and hoist the directives to the top of the chunk.

### Shared Modules (Experimental)

There're always cases that you need to share code among bundles but they don't have to be a separate entry or exports. You want to have them bundled into a shared chunk and then use them in different bundles. You can use shared module convention `[name].[layer]-runtime.[ext]` to create shared modules bundles.

<details>
  <summary>Shared Utils Example</summary>

```js
// src/util.shared-runtime.js
export function sharedUtil() {
  /* ... */
}
```

Then you can use them in different entry files:

```js
// src/index.js
import { sharedUtil } from './util.shared-runtime'
```

```js
// src/lite.js
import { sharedUtil } from './util.shared-runtime'
```

`bunchee` will bundle the shared module into a separate **layer** which matches the file name convention, in the above case it's "shared", and that bundle will be referenced by the different entry bundles.

</details>

With multiple runtime bundles, such as having `default` and `react-server` together. They could have the modules that need to be shared and kept as only one instance among different runtime bundles. You can use the shared module convention to create shared modules bundles for different runtime bundles.

<details>
  <summary>Shared Runtime Module Example</summary>

```js
'use client'
// src/app-context.shared-runtime.js
export const AppContext = React.createContext(null)
```

Then you can use them in different entry files:

```js
// src/index.js
import { AppContext } from './app-context.shared-runtime'
```

```js
// src/index.react-server.js
import { AppContext } from './app-context.shared-runtime'
```

`app-context.shared-runtime` will be bundled into a separate chunk that only has one instance and be shared among different runtime bundles.

</details>

### CLI

#### CLI Options

`bunchee` CLI provides few options to create different bundles or generating types.

- Output (`-o <file>`): Specify output filename.
- Format (`-f <format>`): Set output format (default: `'esm'`).
- External (`--external <dep,>`): Specifying extra external dependencies, by default it is the list of `dependencies` and `peerDependencies` from `package.json`. Values are separate by comma.
- Target (`--target <target>`): Set ECMAScript target (default: `'es2015'`).
- Runtime (`--runtime <runtime>`): Set build runtime (default: `'browser'`).
- Environment (`--env <env,>`): Define environment variables. (default: `NODE_ENV`, separate by comma)
- Working Directory (`--cwd <cwd>`): Set current working directory where containing `package.json`.
- Minify (`-m`): Compress output.
- Watch (`-w`): Watch for source file changes.
- No Clean(`--no-clean`): Do not clean the dist folder before building. (default: `false`)
- TSConfig (`--tsconfig <path>`): Specify the path to the TypeScript configuration file. (default: `tsconfig.json`)
- Bundle Types (`--dts-bundle`): Bundle type declaration files. (default: `false`)

```sh
cd <project-root-dir>

# specifying input, output and format

bunchee ./src/index.js -f cjs -o ./dist/bundle.js
bunchee ./src/index.js -f esm -o ./dist/bundle.esm.js

# build node.js library, or change target to es2019
bunchee ./src/index.js --runtime node --target es2019
```

#### Specifying extra external dependencies

By default, `bunchee` will mark all the `dependencies` and `peerDependencies` as externals so you don't need to pass them as CLI args.
But if there's any dependency that used but not in the dependency list and you want to mark as external, you can use the `--external` option to specify them.

```sh
bunchee --external=dep1,dep2,dep3
```

Replace `dep1`, `dep2`, and `dep3` with the names of the dependencies you want to exclude from the bundle.

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

You can use `index.<export-type>.<ext>` to override the input source file for specific export name. Or using `<export-path>/index.<export-type>.<ext>` also works. Such as:

```
|- src/
  |- index/.ts
  |- index.react-server.ts
  |- index.edge-light.ts
```

This will match the export name `"react-server"` and `"edge-light"` then use the corresponding input source file to build the bundle.

#### Auto Development and Production Mode

`process.env.NODE_ENV` is injected by default if present that you don't need to manually inject yourself. If you need to separate the development build and production build, `bunchee` provides different export conditions for development and production mode with `development` and `production` export conditions.

```json
{
  "exports": {
    "development": "./dist/index.development.js",
    "production": "./dist/index.production.js"
  }
}
```

Then you can use `bunchee` to build the development bundle and production bundle automatically.

### CSS

`bunchee` has basic CSS support for pure CSS file imports. It will be bundled into js bundle and insert the style tag into the document head when the bundle is loaded by browser.

```css
/* src/style.css */
.foo {
  color: orange;
}
```

```tsx
// src/index.tsx
import './style.css'

export const Foo = () => <div className="foo">foo</div>
```

### Text Files

If you just want to import a file as string content, you can name the extension as `.txt` or `.data` and it will be bundled as string content.

For example:

src/index.ts

```js
import data from './data.txt'

export default data
```

src/data.txt

```txt
hello world
```

output

```
export default "hello world"
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
  target: 'es2015', // ES syntax target
  runtime: 'nodejs', // 'browser' | 'nodejs'
  cwd: process.cwd(), // string
  clean: true, // boolean
  tsconfig: 'tsconfig.json', // string
})
```

#### Watch Mode

Bunchee offers a convenient watch mode for rebuilding your library whenever changes are made to the source files. To enable this feature, use either `-w` or `--watch`.

#### `target`

If you specify `target` option in `tsconfig.json`, then you don't have to pass it again through CLI.

#### Package lint

`bunchee` has support for checking the package bundles are matched with package exports configuration.

### License

MIT
