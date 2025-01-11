import {
  assertFilesContent,
  createIntegrationTest,
  isWindows,
} from 'testing-utils'

describe('integration bin/multi-path', () => {
  // TODO: handle the transform error on windows
  if (isWindows) {
    it('skip test on windows', () => {})
    return
  }
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
