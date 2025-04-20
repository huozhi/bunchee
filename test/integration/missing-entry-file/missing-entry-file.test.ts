import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration - missing-entry-file', () => {
  const { distDir, job } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    expect(files).toEqual(['index.js'])

    const { stderr } = job
    expect(stderr).toContain(
      'The following exports are defined in package.json but missing source files:',
    )
    // missing ./foo and ./bar
    expect(stderr).toContain('⨯ ./foo')
    expect(stderr).toContain('⨯ ./bar')
    expect(stderr).not.toContain('⨯ ./index')
  })
})
