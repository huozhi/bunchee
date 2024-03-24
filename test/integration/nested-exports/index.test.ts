import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration nested-exports', () => {
  it('should work with nested path in exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'foo/bar.js': "'foo.bar'",
        })
      },
    )
  })
})
