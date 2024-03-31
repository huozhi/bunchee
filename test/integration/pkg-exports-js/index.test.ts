import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration pkg-exports-js', () => {
  it('should generate proper assets with js', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.cjs', 'index.mjs', 'index.esm.js']
        assertContainFiles(distDir, distFiles)
      },
    )
  })
})
