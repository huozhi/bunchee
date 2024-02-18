import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration esm-pkg-cjs-main-field', () => {
  it('should work on ESM package, main field as CJS ', async () => {
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
