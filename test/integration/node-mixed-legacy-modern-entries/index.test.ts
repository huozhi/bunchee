import { createIntegrationTest, assertContainFiles } from '../../testing-utils'

describe('node-mixed-legacy-modern-entries', () => {
  it('should deduplicate entries', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout }) => {
        const distFiles = ['index.js', 'index.mjs', 'index.d.ts', 'index.d.mts']
        assertContainFiles(distDir, distFiles)
        for (const filename of distFiles) {
          // only contain file name once
          expect(stdout.split(filename).length).toBe(2)
        }
      },
    )
  })
})
