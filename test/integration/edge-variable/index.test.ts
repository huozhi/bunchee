import { createIntegrationTest, assertFilesContent } from '../../testing-utils'

describe('integration edge-variable', () => {
  it('should work with edge export condition', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        assertFilesContent(distDir, {
          'index.js': /typeof EdgeRuntime/,
          'index.edge.js': /const variable = \"string\"/, // typeof "edge-runtime"
        })
      },
    )
  })
})
