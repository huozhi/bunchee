import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        assertFilesContent(distDir, {
          'index.js': `const dep = 'polyfill-dep'`,
        })
      },
    )
  })
})
