import { describe, expect, it } from 'vitest'
import {
  assertContainFiles,
  createJob,
  getFileContents,
} from '../../testing-utils'

describe('integration dotted-subpaths', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should build subpaths that contain a literal dot', async () => {
    // Regression: `./v1.2/thing` and `./charts.min` were truncated to `./v1`
    // and `./charts`, so neither entry resolved to a source file.
    await assertContainFiles(distDir, [
      'index.js',
      'v1.2/thing.js',
      'charts.min.js',
    ])

    const contents = await getFileContents(distDir)
    expect(contents['v1.2/thing.js']).toContain('thing')
    expect(contents['charts.min.js']).toContain('charts')
  })
})
