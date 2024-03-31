import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration ts-dual-package-module', () => {
  it('should ensure generated assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.js', 'index.cjs']
        assertContainFiles(distDir, distFiles)
      },
    )
  })
})
