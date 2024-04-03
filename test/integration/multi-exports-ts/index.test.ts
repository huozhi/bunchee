import { createIntegration, assertFilesContent } from '../utils'

describe('integration multi-exports', () => {
  const { dir } = createIntegration({
    directory: __dirname,
  })
  it('should work with multi exports condition', async () => {
    assertFilesContent(dir, {
      './dist/cjs/index.js': `var foo = require('multi-exports-ts/foo')`,
      './dist/cjs/index.d.cts': `import { Foo } from '../../foo/cjs/index.cjs'`,
      './dist/es/index.mjs': `import { foo } from 'multi-exports-ts/foo'`,
      './dist/es/index.d.mts': `import { Foo } from '../../foo/es/index.mjs'`,
      './foo/cjs/index.js': `exports.foo = foo`,
      './foo/cjs/index.d.cts': `export { type Foo, foo }`,
      './foo/es/index.mjs': `export { foo }`,
      './foo/es/index.d.mts': `export { type Foo, foo }`,
      './types/types.d.ts': `export type { SharedType }`,
    })
  })
})
