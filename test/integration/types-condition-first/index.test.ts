import { describe, expect, it } from 'vitest'
import {
  assertContainFiles,
  createJob,
  getFileContents,
} from '../../testing-utils'

describe('integration types-condition-first', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should emit declarations, not JS, when types nests the format conditions', async () => {
    await assertContainFiles(distDir, [
      'index.js',
      'index.cjs',
      'index.d.mts',
      'index.d.cts',
    ])

    const contents = await getFileContents(distDir)

    // Regression: `types.import` used to be classified by its last condition
    // (`import`), so the JS bundle was written into the .d.mts/.d.cts files.
    for (const dtsFile of ['index.d.mts', 'index.d.cts']) {
      expect(contents[dtsFile]).toContain('declare const value: number')
      expect(contents[dtsFile]).not.toContain('const value = 1')
    }

    expect(contents['index.js']).toContain('const value = 1')
    expect(contents['index.cjs']).toContain('const value = 1')
  })
})
