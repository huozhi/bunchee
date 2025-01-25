import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration shared-module-ts-esm', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should contain correct type file path of shared chunks', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual([
      '_util.d.ts',
      '_util.js',
      '_util.mjs',
      'cjs/index.d.ts',
      'cjs/index.js',
      'es/index.mjs',
    ])
  })
})
