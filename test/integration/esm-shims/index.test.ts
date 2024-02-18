import { createIntegrationTest, assertFilesContent } from '../utils'

describe('integration', () => {
  test(`esm-shims`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir }) => {
        const requirePolyfill =
          'const require = __node_cjsModule.createRequire(import.meta.url)'
        const filenamePolyfill =
          'const __filename = __node_cjsUrl.fileURLToPath(import.meta.url)'
        const dirnamePolyfill =
          'const __dirname = __node_cjsPath.dirname(__filename)'

        await assertFilesContent(fixturesDir, {
          './dist/require.mjs': requirePolyfill,
          './dist/filename.mjs': filenamePolyfill,
          './dist/dirname.mjs': dirnamePolyfill,
          './dist/require.js': /require\(/,
          './dist/filename.js': /__filename/,
          './dist/dirname.js': /__dirname/,
        })
      },
    )
  })
})
