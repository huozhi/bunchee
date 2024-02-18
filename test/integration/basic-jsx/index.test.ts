import { assertFixturesContainFiles, createIntegrationTest } from '../utils'

describe('integration', () => {
  test(`basic-jsx`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ code, stderr, stdout }) => {
        expect(code).toBe(0)

        expect(stderr + stdout).not.toContain('(swc plugin)')
        assertFixturesContainFiles(__dirname, ['./dist/index.js', './dist/index.mjs'])
      },
    )
  })
})
