import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration', () => {
  test(`edge-variable`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        assertFilesContent(distDir, {
          'index.js': /typeof EdgeRuntime/,
          'index.edge.js': /typeof "edge-runtime"/,
        })
      },
    )
  })
})
