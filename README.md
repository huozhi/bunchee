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

---

**bunchee** is a zero-configuration bundler designed to streamline package building by adhering to the `exports` field in your **package.json**. Powered by Rollup and SWC ⚡️, it generates output based on your config, supporting both CommonJS and ESModules.

By using the standard `exports` configuration as the single source of truth, **bunchee** automatically aligns entry file conventions with your exports, ensuring seamless and efficient builds.

## Quick Start

### Installation

```sh
npm install --save-dev bunchee typescript
```

### Configuration

Create entry files of your library and `package.json`.

```sh
cd ./coffee
mkdir src && touch ./src/index.ts && touch package.json
```

Add the exports in `package.json`.

```json5
{
  "name":"coffee",
  "type":"module",
  "main":"./dist/index.js",
  "scripts":{
    "build":"bunchee"
  }
}
```

#### Build

```sh
npm run build
```

## Usage

### Entry Files

Then files in `src` folders will be treated as entry files and match the export names in package.json.
Simply like Node.js module resolution, each export name will match the file in `src/` directory.

Here's a example of entry files and exports configuration:

| **File**             | **Exports Name**       |
| -------------------- | ---------------------- |
| `src/index.ts`       | `"."` (default export) |
| `src/lite.ts`        | `"./lite"`             |
| `src/react/index.ts` | `"./react"`            |

```json5
{
  "name": "coffee",
  "scripts": {
    "build: "bunchee",
  },
  "type": "module",
  "exports": {
    // entry: ./src/index.ts
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
    },

    // entry: ./src/lite.ts
    "./lite": "./dist/lite.js",

    // entry: ./src/react/index.ts
    "./react": "./dist/react.js",
  },
}
```

### Output Formats

**bunchee** detects the format of each entry-point based on export condition type or the file extension. It supports the following output formats:

| `package.json` Field | Output format                    |
| -------------------- | -------------------------------- |
| `main`               | Default                          |
| `types`              | TypeScript declaration           |
| `exports`            | Default                          |
| `exports.require`    | CommonJS                         |
| `exports.import`     | Default                          |
| `exports.types`      | TypeScript declaration of export |
| `bin`                | Default                          |
| `bin.<name>`         | Default                          |

The **Default** output format is determined by the file extension:

| File Extension | Output format                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.js`          | Determined by `package.json#type`, CommonJS by default                                                                                                                                  |
| `.cjs`         | [CommonJS](https://nodejs.org/api/packages.html#:~:text=Files%20ending%20with%20.cjs%20are%20always%20loaded%20as%20CommonJS%20regardless%20of%20the%20nearest%20parent%20package.json) |
| `.mjs`         | [ECMAScript Modules](https://nodejs.org/api/modules.html#the-mjs-extension)                                                                                                             |

### External Dependencies

The `dependencies` and `peerDependencies` will be marked as externalized and wont be included in the bundle. If you want to include them in the bundle, you can use the `--no-external` option. Or you can import the `devDependencies` in your source code to bundle them.

```json5
{
  // Externalized
  "dependencies": {
    /* ... */
  },
  "peerDependencies": {
    /* ... */
  },

  // Bundled
  "devDependencies": {
    /* ... */
  },
}
```

### Multiple Runtime

For exports condition like `react-native`, `react-server` and `edge-light` as they're special platforms, they could have different exports or different code conditions. In this case bunchee provides an override input source file convention if you want to build them as different code bundle.

For instance:

```json5
{
  "exports": {
    "react-server": "./dist/react-server.mjs",
    "edge-light": "./dist/edge-light.mjs",
    "import": "./dist/index.mjs",
  },
}
```

### Path Alias

`bunchee` supports both TypeScript `paths` config and Node.js [`imports field`](https://nodejs.org/api/packages.html#subpath-imports) in `package.json` for path aliasing. It will resolve the path alias to the correct file path. If you're using modern TypeScript versions, you can also directly configure the `imports` field in `package.json` and it will work as a charm.

```json5
// package.json
{
  "imports": {
    "#util": "./src/utils.ts",
  },
}
```

### Binary CLI

To build executable files with the `bin` field in package.json, `bunchee` requires you to create the `bin` directory under `src` directory. The source file matching will be same as the entry files convention.

For example:

```bash
|- src/
  |- bin/
    |- index.ts
```

This will match the `bin` field in package.json as:

```json5
{
  "bin": "./dist/bin.js",
}
```

If you have multiple binaries, you can create multiple files under the `bin` directory. Check the below example for more details.

<details>
  <summary>Multiple Binaries</summary>

For named executable files, you can create multiple files under the `bin` directory.

```bash
|- src/
  |- bin/

```

This will match the `bin` field in package.json as:

```json5
{
  "bin": {
    "foo": "./dist/bin/a.js",
    "bar": "./dist/bin/b.js",
  },
}
```

</details>

> Note: For multiple `bin` files, the filename should match the key name in the `bin` field.

### Server Components

**bunchee** supports building React Server Components and Server Actions with directives like `"use client"` or `"use server"`. It generates separate chunks for the server or client boundaries. When integrated to framework like Next.js, it can correctly handles the boundaries with the split chunks.

### Shared Modules

Sometimes, you may want to share a chunk across multiple bundles without promoting it to separate entries or exports, such as single instance of React context module, shared utils, etc. In these cases, **shared modules** will help you achieve the goal. Files or directories **prefixed with an underscore** (`_<name>.<ext>` or `_<name>/**`) will be treated as **shared modules**.

These conventions are kept private and are not going to be treat as shared modules or entry points. For example, test or mock files like `_foo/a.test.ts` will be ignored and not included as shared modules.

<details>
  <summary>Shared Utils Example</summary>

```js
// src/_util.js
export function sharedUtil() {
  /* ... */
}
```

You can then use them in different entry files:

```js
// src/index.js
import { sharedUtil } from './_util'
```

```js
// src/lite.js
import { sharedUtil } from './_util'
```

`bunchee` will bundle the shared module into a separate chunk, keeping it private and ensuring it's referenced by multiple entry bundles.

</details>

For scenarios involving multiple runtime bundles, such as `default` and `react-server`, modules that need to be shared and remain as a single instance across different runtime bundles can also follow this convention. The leading underscore (`_`) ensures that these modules are private to your application while facilitating reuse.

<details>
  <summary>Shared Runtime Module Example</summary>

```js
'use client'
// src/_app-context.js
export const AppContext = React.createContext(null)
```

These modules can be imported in various runtime entry files:

```js
// src/index.js
import { AppContext } from './_app-context'
```

```js
// src/index.react-server.js
import { AppContext } from './_app-context'
```

The `_app-context` module will be bundled into a shared chunk that exists as a single instance across different runtime bundles.

</details>

This convention keeps shared modules private while enabling efficient bundling and reuse across your codebase.

### CLI

#### CLI Options

`bunchee` CLI provides few options to create different bundles or generating types. Call `bunchee --help` to see the help information in the terminal.

Here are the available options for the CLI:

```sh
cd <project-root-dir>

# Build based on the package.json configuration
bunchee --runtime node -o ./dist/bundle.js
bunchee -f esm -o --target es2022 ./dist/bundle.esm.js

# Specify the input source file
bunchee ./src/foo.ts -o ./dist/foo.js
```

#### Specifying extra external dependencies

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

#### Prepare Package

```sh
# Use bunchee to prepare package.json configuration
npm exec bunchee prepare
# "If you're using other package manager such as pnpm"
# pnpm bunchee prepare

# "Or use with npx"
# npx bunchee@latest prepare
```

Or you can checkout the following cases to configure your package.json.

<details>
  <summary>JavaScript ESModule</summary>

Then use use the [exports field in package.json](https://nodejs.org/api/packages.html#exports-sugar) to configure different conditions and leverage the same functionality as other bundlers, such as webpack. The exports field allows you to define multiple conditions.

```json5
{
  "files": ["dist"],
  "type": "module",
  "exports": {
    ".": "./dist/es/index.js",
    "./react": "./dist/es/react.js",
  },
  "scripts": {
    "build": "bunchee",
  },
}
```

</details>

<details>
  <summary>TypeScript</summary>

If you're building a TypeScript library, separate the types from the main entry file and specify the types path in package.json. Types exports need to stay on the top of each export with `types` condition, and you can use `default` condition for the JS bundle file.

```json5
{
  "files": ["dist"],
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js",
    },
    "./react": {
      "types": "./dist/react/index.d.ts",
      "default": "./dist/react/index.js",
    },
  },
  "scripts": {
    "build": "bunchee",
  },
}
```

</details>

<details>
  <summary>Hybrid (CJS & ESM) Module Resolution with TypeScript</summary>
If you're using TypeScript with Node 10 and Node 16 module resolution, you can use the `types` field in package.json to specify the types path. Then `bunchee` will generate the types file with the same extension as the main entry file.

_NOTE_: When you're using `.mjs` or `.cjs` extensions with TypeScript and modern module resolution (above node16), TypeScript will require specific type declaration files like `.d.mts` or `.d.cts` to match the extension. `bunchee` can automatically generate them to match the types to match the condition and extensions.

```json5
{
  "files": ["dist"],
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "import": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js",
    },
    "require": {
      "types": "./dist/index.d.cts",
      "default": "./dist/index.cjs",
    },
  },
  "scripts": {
    "build": "bunchee",
  },
}
```

</details>

#### Lint Package

`lint` command will check the package.json configuration is valid or not, it can valid few things like:

- if the entry files are matched with the exports conditions.
- if the entry files are matched with the exports paths.

```sh
# Use bunchee to lint if the package.json configuration is valid
npm exec bunchee lint
```

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

```json5
{
  "exports": {
    "development": './dist/index.development.js',
    "production": './dist/index.production.js',
  },
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

```js
export default 'hello world'
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
To target a range of browsers, you can use the `browserslist` field in `package.json`, bunchee will use it to determine the target browsers for the output bundle.

For example:

```json5
{
  "browserslist": [
    "last 1 version",
    "> 1%",
    "maintained node versions",
    "not dead",
  ],
}
```

#### Package lint

`bunchee` has support for checking the package bundles are matched with package exports configuration.

### License

MIT
