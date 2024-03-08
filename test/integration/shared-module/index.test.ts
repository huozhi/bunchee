import { promises as fsp } from 'fs'
import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const files = await fsp.readdir(distDir)
        const sharedModuleFiles = files.filter((file) =>
          file.startsWith('shared-'),
        )
        const entryModuleFiles = files.filter(
          (file) => !file.startsWith('shared-'),
        )

        expect(sharedModuleFiles).toHaveLength(2)
        expect(entryModuleFiles).toHaveLength(4)

        await assertFilesContent(distDir, {
          [sharedModuleFiles[0]]: /'common:shared'/,
          [sharedModuleFiles[1]]: /'common:shared'/,
          ['index.js']: (content) => {
            return (
              !content.includes('common:shared') &&
              content.includes('sharedApi')
            )
          },
          ['index.cjs']: (content) => {
            return (
              !content.includes('common:shared') &&
              content.includes('sharedApi')
            )
          },
          ['another.js']: (content) => {
            return (
              !content.includes('common:shared') &&
              content.includes('anotherSharedApi')
            )
          },
          ['another.cjs']: (content) => {
            return (
              !content.includes('common:shared') &&
              content.includes('anotherSharedApi')
            )
          },
        })
      },
    )
  })
})
