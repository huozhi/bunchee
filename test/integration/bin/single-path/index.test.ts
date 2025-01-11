import {
  createIntegrationTest,
  assertContainFiles,
  assertFilesContent,
  getFileNamesFromDirectory,
  isWindows,
} from 'testing-utils'

describe('integration bin/single-path', () => {
  // TODO: handle the transform error on windows
  if (isWindows) {
    it('skip test on windows', () => {})
    return
  }
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
