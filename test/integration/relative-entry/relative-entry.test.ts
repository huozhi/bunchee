import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration relative-entry', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'index.js': `from './relative.js'`,
        })
      },
    )
  })
})
