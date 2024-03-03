import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration esm-pkg-cjs-main-field', () => {
  it('should work with ESM package with CJS main field ', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.cjs', 'index.mjs']
        assertContainFiles(distDir, distFiles)
      },
    )
  })
})
