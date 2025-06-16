import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration - declaration-map', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should generate sourcemap for types declaration', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual(['index.d.ts', 'index.d.ts.map', 'index.js'])
  })
})
