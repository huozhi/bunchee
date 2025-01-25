import { describe, expect, it } from 'vitest'
import { readFile } from 'fs/promises'
import { createJob } from '../../testing-utils'

describe('integration externals', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should handle externals', async () => {
    const distFile = `${distDir}/index.js`
    const content = await readFile(distFile, { encoding: 'utf-8' })
    expect(content).toMatch(/['"]peer-dep['"]/)
    expect(content).toMatch(/['"]peer-dep-meta['"]/)
  })
})
