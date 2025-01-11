import {
  createIntegrationTest,
  assertFilesContent,
  getFileContents,
} from 'testing-utils'

describe('integration esm-shims', () => {
  it('should work with ESM shims', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const requirePolyfill =
          'const require = __node_cjsModule.createRequire(import.meta.url)'
        const filenamePolyfill =
          'const __filename = __node_cjsUrl.fileURLToPath(import.meta.url)'
        const dirnamePolyfill =
          'const __dirname = __node_cjsPath.dirname(__filename)'

        await assertFilesContent(distDir, {
          'filename.mjs': filenamePolyfill,
          'dirname.mjs': dirnamePolyfill,
          'custom-require.mjs': (code) => !code.includes(requirePolyfill),
          'require.js': /require\(/,
          'filename.js': /__filename/,
          'dirname.js': /__dirname/,
          'custom-require.js': (code) => !code.includes(requirePolyfill),
        })

        const contents = await getFileContents(distDir, ['require.mjs'])
        expect(contents['require.mjs']).not.toContain(requirePolyfill)
        expect(contents['require.mjs']).toContain('function getRequireModule')
        expect(contents['require.mjs']).toContain('import.meta.url')
      },
    )
  })
})
