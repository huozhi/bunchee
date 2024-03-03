import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration dev-prod-nested-convention', () => {
  it('should work with dev and prod optimize conditions', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          // index export
          'index.development.js': /= "development"/,
          'index.development.mjs': /= "development"/,
          'index.production.js': /= "production"/,
          'index.production.mjs': /= "production"/,
          'index.js': /= 'index'/,
          'index.mjs': /= 'index'/,

          // core export
          'core.development.js': `= 'core' + "development"`,
          'core.development.mjs': `= 'core' + "development"`,
          'core.production.js': `= 'core' + "production"`,
          'core.production.mjs': `= 'core' + "production"`,
          'core.js': /= 'core'/,
          'core.mjs': /= 'core'/,
        })
      },
    )
  })
})
