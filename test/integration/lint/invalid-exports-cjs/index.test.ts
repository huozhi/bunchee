import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration invalid-exports-cjs', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn on invalid exports as CJS', () => {
    const { stderr } = job
    expect(stderr).toContain('Missing package name')
    expect(stderr).toContain(
      'Cannot export `require` field with .mjs extension in CJS package, only .cjs and .js extensions are allowed',
    )
    expect(stderr).toContain('./dist/index.mjs')
    expect(stderr).toContain(
      'Cannot export `import` field with .js or .cjs extension in CJS package, only .mjs extensions are allowed',
    )
    expect(stderr).toContain('./dist/foo.js')
    expect(stderr).not.toContain('./dist/index.esm.js')
  })
})
