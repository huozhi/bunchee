import { describe, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration - <name>', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    const files = getFileNamesFromDirectory(distDir)
    // expect(files).toEqual([])
  })
})
