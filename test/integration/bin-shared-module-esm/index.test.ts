import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration bin-shared-module-esm', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should only emit esm files for private shared modules used by esm bins', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual([
      '_cli.d.ts',
      '_cli.js',
      'bin/check.js',
      'bin/run.js',
    ])
  })
})
