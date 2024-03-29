import {
  createIntegrationTest,
  assertContainFiles,
  assertFilesContent,
} from '../../utils'

describe('integration bin/patch-binary', () => {
  it('should patch binary directive', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['bin.js']
        await assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'bin.js': "#!/usr/bin/env node\nconsole.log('Hello, world!');",
        })
      },
    )
  })
})
