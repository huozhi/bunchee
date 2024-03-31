import {
  assertContainFiles,
  assertFilesContent,
  createIntegrationTest,
} from '../utils'

describe('integration ts-no-emit', () => {
  it('should succeed the build', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        // should still emit declaration files
        const distFiles = ['index.js', 'index.d.ts']

        await assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'index.d.ts': 'declare const _default: () => string;',
        })
      },
    )
  })
})
