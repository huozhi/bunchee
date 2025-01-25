import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration invalid-exports-esm', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn on invalid exports as ESM', async () => {
    const { stderr } = job
    expect(stderr).not.toContain('Missing package name')
    expect(stderr).toContain(
      'Cannot export `require` field with .js or .mjs extension in ESM package, only .cjs extensions are allowed',
    )
    expect(stderr).toContain('./dist/index.js')
    expect(stderr).toContain(
      'Cannot export `import` field with .cjs extension in ESM package, only .js and .mjs extensions are allowed',
    )
    expect(stderr).toContain('./dist/foo.cjs')
  })
})
