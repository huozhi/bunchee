import {
  assertContainFiles,
  assertFilesContent,
  createIntegrationTest,
} from '../utils'

describe('integration - ts-allow-js', () => {
  it('should generate proper assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.js', 'index.d.ts']
        await assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'index.d.ts': 'declare function _default(): string;',
        })
      },
    )
  })
})
