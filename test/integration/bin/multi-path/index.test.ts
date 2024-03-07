import { assertFilesContent, createIntegrationTest } from '../../utils'

describe('integration bin/multi-path', () => {
  it('should work with bin as multi path', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          'bin/a.js': '#!/usr/bin/env node',
          'bin/b.js': '#!/usr/bin/env node',
        })
      },
    )
  })
})
