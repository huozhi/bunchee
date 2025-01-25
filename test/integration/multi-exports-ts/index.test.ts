import { describe, it } from 'vitest'
import { createJob, assertFilesContent } from '../../testing-utils'

describe('integration multi-exports', () => {
  const { dir } = createJob({
    directory: __dirname,
  })
  it('should work with multi exports condition', async () => {
    await assertFilesContent(dir, {
      './dist/cjs/index.js': `= require('../../foo/cjs/index.js')`,
      './dist/cjs/index.d.cts': `import { Foo } from '../../foo/cjs/index.cjs'`,
      './dist/es/index.mjs': `import { foo } from '../../foo/es/index.mjs'`,
      './dist/es/index.d.mts': `import { Foo } from '../../foo/es/index.mjs'`,
      './foo/cjs/index.js': `exports.foo = foo`,
      './foo/cjs/index.d.cts': `export { type Foo, foo }`,
      './foo/es/index.mjs': `export { foo }`,
      './foo/es/index.d.mts': `export { type Foo, foo }`,
      './dist/types/types.d.ts': `export type { SharedType }`,
    })
  })
})
