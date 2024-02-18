import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration', () => {
  test(`entry-index-index`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'index.js': /'index'/,
          'react-server.js': /\'react-server\'/,
        })
      },
    )
  })
})
