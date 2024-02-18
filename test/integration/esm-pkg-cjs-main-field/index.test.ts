import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration', () => {
  test(`esm-pkg-cjs-main-field`, async () => {
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
