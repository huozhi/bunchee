import { join } from 'path'
import { existsSync } from 'fs'
import { createJob } from '../../testing-utils'

describe('integration ts-error', () => {
  const { distDir, job } = createJob({ directory: __dirname })

  it('should error when ts is not properly resolved', async () => {
    const { stderr } = job
    const distFile = join(distDir, './index.js')
    expect(existsSync(distFile)).toBe(false)
    expect(stderr).toMatch(/Could not load TypeScript compiler/)
  })
})
