import { describe, expect, it } from 'vitest'
import { createJob, assertContainFiles } from '../../testing-utils'

describe('node-mixed-legacy-modern-entries', () => {
  const { distDir, job } = createJob({ directory: __dirname })

  it('should deduplicate entries', async () => {
    const { stdout } = job
    const distFiles = ['index.js', 'index.mjs', 'index.d.ts', 'index.d.mts']
    assertContainFiles(distDir, distFiles)
    for (const filename of distFiles) {
      // only contain file name once
      expect(stdout.split(filename).length).toBe(2)
    }
  })
})
