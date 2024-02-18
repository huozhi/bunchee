import { createIntegrationTest, assertFilesContent } from '../utils'

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
          'require.mjs': requirePolyfill,
          'filename.mjs': filenamePolyfill,
          'dirname.mjs': dirnamePolyfill,
          'require.js': /require\(/,
          'filename.js': /__filename/,
          'dirname.js': /__dirname/,
        })
      },
    )
  })
})
