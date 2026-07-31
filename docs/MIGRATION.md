# Migrating to bunchee 7

## Requirements

bunchee 7 requires Node.js 22.12 or newer. Its default JavaScript target is
now ES2022; pass `--target` or configure `compilerOptions.target` when an older
output target is required.

TypeScript 5 and 6 continue to work as before. TypeScript 7 no longer exposes
the JavaScript compiler API bunchee uses to emit declarations, so TypeScript 7
projects must also install its official compatibility package:

```sh
npm install --save-dev @typescript/typescript6
```

## ESM defaults

The `bunchee` package itself is now ESM. Replace CommonJS loading of its Node.js
API with an ESM import:

```diff
-const { bundle } = require('bunchee')
+import { bundle } from 'bunchee'
```

`bunchee prepare` now generates an ESM-only package by default. Pass `--cjs`
when generating both ESM and CommonJS exports:

```sh
bunchee prepare --cjs
```

The old `--prepare` build flag has been removed; use the `bunchee prepare`
command explicitly.

## Package metadata

Newly prepared packages no longer receive a legacy `module` field. Prefer the
standard `exports` field, with `main` and `types` only when compatibility with
older resolvers is needed.

TypeScript still supports `typings` as a legacy alias for `types`, but bunchee 7
no longer reads it as the package-level declaration target. Rename it to
`types`, or add a `types` export condition:

```diff
-"typings": "./dist/index.d.ts"
+"types": "./dist/index.d.ts"
```

## Output chunks

bunchee 7 builds entries through a shared module graph. This avoids rebuilding
common modules, improves declaration performance, and keeps directive layers
such as `use client`, `use server`, and `use cache` separate. Packages that
inspect generated chunk names should treat those names as build artifacts and
update any snapshots after migrating.
