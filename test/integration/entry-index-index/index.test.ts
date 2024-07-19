import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration entry-index-index', () => {
  it('should work with index file inside index directory', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout }) => {
        await assertFilesContent(distDir, {
          'default.js': /'index'/,
          'react-server.js': /\'react-server\'/,
        })

        expect(stdout).toContain('dist/react-server.js')
        expect(stdout).toContain('dist/default.js')
      },
    )
  })
})
