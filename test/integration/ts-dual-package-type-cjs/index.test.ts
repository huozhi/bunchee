import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration ts-dual-package-type-cjs', () => {
  it('should ensure generated assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        await assertContainFiles(distDir, ['index.js', 'index.mjs'])
      },
    )
  })
})
