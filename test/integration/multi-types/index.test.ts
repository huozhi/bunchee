import {
  assertFilesContent,
  createIntegrationTest,
  getChunkFileNamesFromLog,
  stripANSIColor,
} from '../utils'

describe('integration multi-types', () => {
  it('should contain files', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout }) => {
        const contentsRegex = {
          'index.js': /'index'/,
          // types
          'index.d.ts': `declare const index`,
          'index.d.mts': `declare const index`,
          'index.d.cts': `declare const index`,
        }

        await assertFilesContent(distDir, contentsRegex)

        const log = `\
          dist/index.cjs
          dist/index.js
          dist/index.mjs
          dist/index.d.mts
          dist/index.d.cts
        `

        const rawStdout = stripANSIColor(stdout)
        getChunkFileNamesFromLog(log).forEach((chunk: string) => {
          expect(rawStdout).toContain(chunk)
        })
      },
    )
  })
})
