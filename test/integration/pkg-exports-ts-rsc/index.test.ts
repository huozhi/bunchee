import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration pkg-exports-ts-rsc', () => {
  it('should generate proper assets for rsc condition with ts', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertFilesContent(distDir, {
          './index.mjs': /const shared = true/,
          './react-server.mjs': /'react-server'/,
          './react-native.js': /'react-native'/,
          './index.d.ts': /declare const shared = true/,
          './api.mjs': /\'pkg-export-ts-rsc\'/,
        })
      },
    )
  })
})
