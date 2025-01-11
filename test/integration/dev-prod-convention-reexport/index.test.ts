import { createIntegrationTest, assertFilesContent } from '../../testing-utils'

describe('integration dev-prod-convention-reexport', () => {
  it('should work with dev and prod optimize conditions', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          // index export
          'index.dev.js': /core.dev.js/,
          'index.dev.mjs': /core.dev.mjs/,
          'index.prod.js': /core.prod.js/,
          'index.prod.mjs': /core.prod.mjs/,
          'index.js': /core.js/,
          'index.mjs': /core.mjs/,
        })
      },
    )
  })
})
