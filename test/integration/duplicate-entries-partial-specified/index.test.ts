import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration duplicate-entries-partial-specified', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should not generate js types paths if not specified', async () => {
    expect(await getFileNamesFromDirectory(distDir)).toEqual([
      'a.js',
      'a.workerd.js',
    ])
  })
})
