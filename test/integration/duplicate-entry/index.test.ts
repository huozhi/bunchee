import { createIntegrationTest } from '../utils'
import { assertContainFiles } from '../../testing-utils'

describe('integration', () => {
  test(`duplicate-entry`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir, stdout }) => {
        const distFiles = [
          'dist/index.js',
          'dist/index.mjs',
          'dist/index.d.ts',
          'dist/index.d.mts',
        ]
        assertContainFiles(fixturesDir, distFiles)
        for (const filename of distFiles) {
          // only contain file name once
          expect(stdout.split(filename).length).toBe(2)
        }
      },
    )
  })
})
