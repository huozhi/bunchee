import { createIntegrationTest } from '../utils'
import { assertContainFiles } from '../../testing-utils'

describe('integration', () => {
  test(`esm-pkg-cjs-main-field`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir }) => {
        const distFiles = ['./dist/index.cjs', './dist/index.mjs']
        assertContainFiles(fixturesDir, distFiles)
      },
    )
  })
})
