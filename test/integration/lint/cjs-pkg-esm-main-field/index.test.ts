import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration cjs-pkg-esm-main-field', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })
  it('should warn if main field with .mjs extension in CJS package', async () => {
    const { stderr } = job
    expect(stderr).toContain(
      'Cannot export `main` field with .mjs extension in CJS package, only .js extension is allowed',
    )
  })
})
