import { createIntegrationTest, assertFilesContent, deleteFile } from '../utils'

afterEach(async () => {
  await deleteFile(`${__dirname}/fixtures/tsconfig.json`)
})

describe('integration dev-prod-convention', () => {
  it('should work on environment conventions', async () => {
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
      },
    )
  })
})
