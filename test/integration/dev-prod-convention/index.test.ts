import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration', () => {
  test(`dev-prod-convention`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        filesToRemove: [`tsconfig.json`],
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'index.development.js': /= "development"/,
          'index.development.mjs': /= "development"/,
          'index.production.js': /= "production"/,
          'index.production.mjs': /= "production"/,
          'index.js': /= 'index'/,
          'index.mjs': /= 'index'/,
        })
      },
    )
  })
})
