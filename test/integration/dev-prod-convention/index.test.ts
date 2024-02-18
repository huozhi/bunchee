import { createIntegrationTest } from '../utils'
import { assertFilesContent } from '../../testing-utils'

describe('integration', () => {
  test(`dev-prod-convention`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        filesToRemove: [`tsconfig.json`],
      },
      async ({ fixturesDir }) => {
        await assertFilesContent(fixturesDir, {
          './dist/index.development.js': /= "development"/,
          './dist/index.development.mjs': /= "development"/,
          './dist/index.production.js': /= "production"/,
          'dist/index.production.mjs': /= "production"/,
          './dist/index.js': /= 'index'/,
          './dist/index.mjs': /= 'index'/,
        })
      },
    )
  })
})
