import { createIntegrationTest, assertFilesContent } from 'testing-utils'

describe('browserslist', () => {
  it('should work with basic JSX format', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ distDir }) => {
        assertFilesContent(distDir, {
          'index.js': `_class_private_field_loose_key`,
        })
      },
    )
  })
})
