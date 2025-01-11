import { createIntegrationTest, assertFilesContent } from 'testing-utils'

describe('integration dev-prod-special-convention', () => {
  it('should work with dev prod and special optimize conditions', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'index.react-server.mjs': 'index.react-server',
          'index.development.js': /'index.default'/,
          'index.development.mjs': /'index.default'/,
          'index.production.js': /'index.default'/,
          'index.production.mjs': /'index.default'/,
          // In jest the NODE_ENV is set to test
          'index.js': /'index.default'/,
          'index.mjs': /'index.default'/,
        })
      },
    )
  })
})
