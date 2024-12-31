import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration - shared-module-with-suffix', () => {
  it('should alias correctly for the shared module with special suffix', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        assertFilesContent(distDir, {
          'client.mjs': `./_private/util.browser.mjs`,
        })
      },
    )
  })
})
