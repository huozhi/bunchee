import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration', () => {
  test(`edge-variable`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir }) => {
        assertFilesContent(fixturesDir, {
          './dist/index.js': /typeof EdgeRuntime/,
          './dist/index.edge.js': /typeof "edge-runtime"/,
        })
      },
    )
  })
})
