import { describe, it } from 'vitest'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration pkg-exports-js', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets with js', async () => {
    const distFiles = ['index.cjs', 'index.mjs', 'index.esm.js']
    assertContainFiles(distDir, distFiles)
  })
})
