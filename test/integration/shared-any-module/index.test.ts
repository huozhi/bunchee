import {
  assertFilesContent,
  createIntegrationTest,
  getFileNamesFromDirectory,
} from '../utils'

describe('integration shared-module', () => {
  it('should split all shared module into different chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout }) => {
        const jsFiles = await getFileNamesFromDirectory(distDir)
        expect(jsFiles).toEqual([
          '_internal/util-a.cjs',
          '_internal/util-a.js',
          '_internal/util-b.cjs',
          '_internal/util-b.js',
          'export-a.js',
          'export-b.js',
          'export-c.js',
          'private/_nested/util-c.cjs',
          'private/_nested/util-c.js',
        ])

        await assertFilesContent(distDir, {
          'export-a.js': `'./_internal/util-a.js'`,
          'export-b.js': `'./_internal/util-b.js'`,
          'export-c.js': `'./private/_nested/util-c.js'`,
        })
      },
    )
  })
})
