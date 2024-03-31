import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration - ts-exports-types', () => {
  it('should generate proper assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.mjs', 'index.cjs', 'index.d.ts']
        await assertContainFiles(distDir, distFiles)
      },
    )
  })
})
