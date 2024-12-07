import {
  createIntegrationTest,
  assertContainFiles,
  assertFilesContent,
  getFileNamesFromDirectory,
} from '../../utils'

describe('integration bin/single-path', () => {
  it('should work with bin as single path', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        console.log(
          'getFileNamesFromDirectory',
          getFileNamesFromDirectory(distDir),
        )
        const distFiles = ['bin.js']
        await assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'bin.js': /console.log\('Hello, world!'\)/,
        })
      },
    )
  })
})
