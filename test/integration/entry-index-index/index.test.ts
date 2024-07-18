import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration entry-index-index', () => {
  it('should work with index file inside index directory', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'default.js': /'index'/,
          'react-server.js': /\'react-server\'/,
        })
      },
    )
  })
})

// TODO: fix output log
