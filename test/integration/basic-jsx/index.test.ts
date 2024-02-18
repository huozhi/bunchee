import { createIntegrationTest } from '../utils'
import { assertContainFiles } from '../../testing-utils'

describe('integration', () => {
  test(`basic-jsx`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ fixturesDir, stderr, stdout }) => {
        expect(stderr + stdout).not.toContain('(swc plugin)')
        assertContainFiles(fixturesDir, ['./dist/index.js', './dist/index.mjs'])
      },
    )
  })
})