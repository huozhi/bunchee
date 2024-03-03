import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration dev-prod-convention', () => {
  it('should work with dev and prod optimize conditions', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'index.development.js': /= "development"/,
          'index.development.mjs': /= "development"/,
          'index.production.js': /= "production"/,
          'index.production.mjs': /= "production"/,
          // In jest the NODE_ENV is set to test
          'index.js': /= "test"/,
          'index.mjs': /= "test"/,
        })
      },
    )
  })
})
