import { expect, describe, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration - sourcemap-dts', () => {
  const { distDir } = createJob({
    directory: __dirname,
    args: ['--sourcemap'],
  })
  it('should not generate sourcemap for types', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual(['index.d.ts', 'index.js', 'index.js.map'])
  })
})
