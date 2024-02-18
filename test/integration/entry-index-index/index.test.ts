import { createIntegrationTest } from '../utils'
import { assertFilesContent } from '../../testing-utils'

describe('integration', () => {
  test(`entry-index-index`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir }) => {
        await assertFilesContent(fixturesDir, {
          './dist/index.js': /'index'/,
          './dist/react-server.js': /\'react-server\'/,
        })
      },
    )
  })
})
