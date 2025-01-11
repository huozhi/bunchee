import {
  assertContainFiles,
  createIntegrationTest,
  assertFilesContent,
} from 'testing-utils'

describe('integration - ts-exports-multiple-conditions', () => {
  it('should generate proper assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = [
          // entry files
          'index.js',
          'index.cjs',
          'index.browser.js',
          'index.workerd.js',
          'index.edge-light.js',
          // types
          'index.d.cts',
          'index.d.ts',
          'index.browser.d.ts',
          'index.workerd.d.ts',
          'index.edge-light.d.ts',
        ]
        assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'index.js': (code) => code.includes("const runtime = 'node'"),
          'index.cjs': (code) => code.includes("const runtime = 'node'"),
          'index.browser.js': (code) =>
            code.includes("const runtime = 'browser'"),
          'index.workerd.js': (code) =>
            code.includes("const runtime = 'workerd'"),
          'index.edge-light.js': (code) =>
            code.includes("const runtime = 'edge-light'"),
        })
      },
    )
  })
})
