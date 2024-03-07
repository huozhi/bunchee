import { assertFilesContent, createIntegrationTest } from '../../utils'

describe('integration bin/cts', () => {
  it('should work with bin as .cts extension', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'bin/index.cjs': '#!/usr/bin/env node',
        })
      },
    )
  })
})
