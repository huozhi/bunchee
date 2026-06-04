import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration shared-module-es-only', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should only emit esm files for private shared modules used by esm exports', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual([
      '_shared.d.ts',
      '_shared.js',
      'index.d.ts',
      'index.js',
    ])
  })
})
