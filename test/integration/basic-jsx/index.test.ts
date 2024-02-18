import { createIntegrationTest } from '../utils'
import { assertContainFiles } from '../../testing-utils'

const fixturesDir = `${__dirname}/fixtures`

describe('integration', () => {
  it(`basic-jsx should work properly`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ code, stderr, stdout }) => {
        expect(code).toBe(0)

        expect(stderr + stdout).not.toContain('(swc plugin)')
        assertContainFiles(fixturesDir, ['./dist/index.js', './dist/index.mjs'])
      },
    )
  })
})
