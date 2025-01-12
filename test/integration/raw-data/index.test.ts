import { existsSync } from 'fs'
import { assertFilesContent, createJob } from '../../testing-utils'
import { join } from 'path'

describe('integration - raw-data', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets', async () => {
    const distFile = join(distDir, 'index.js')
    expect(existsSync(distFile)).toBe(true)
    await assertFilesContent(distDir, {
      'index.js': '"thisismydata"',
    })
  })
})
