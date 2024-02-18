import { createIntegrationTest, assertFilesContent, deleteFile } from '../utils'

describe('integration', () => {
  test(`dev-prod-convention`, async () => {
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
          'index.js': /= 'index'/,
          'index.mjs': /= 'index'/,
        })

        await deleteFile(`${__dirname}/fixtures/tsconfig.json`)
      },
    )
  })
})
