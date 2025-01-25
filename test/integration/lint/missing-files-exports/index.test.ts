import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration - lint - missing-files-exports', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn on missing files', async () => {
    const { stderr } = job
    expect(stderr).toContain('Missing files in package.json')
    expect(stderr).toContain('foo/index.js')
  })
})
