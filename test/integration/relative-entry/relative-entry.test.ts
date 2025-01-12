import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration relative-entry', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for each exports', async () => {
    await assertFilesContent(distDir, {
      'index.js': `from './relative.js'`,
    })
  })
})
