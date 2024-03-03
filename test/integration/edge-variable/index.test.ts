import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration edge-variable', () => {
  it('should work with edge export condition', async () => {
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
