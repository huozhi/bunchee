import { describe, expect, it } from 'vitest'
import { createJob, assertContainFiles } from '../../testing-utils'

describe('integration basic-jsx', () => {
  const { job, distDir } = createJob({
    directory: __dirname,
  })
  it('should work with basic JSX format', async () => {
    const { stdout, stderr } = job
    expect(stderr + stdout).not.toContain('(swc plugin)')
    assertContainFiles(distDir, ['index.js', 'index.mjs'])
  })
})
