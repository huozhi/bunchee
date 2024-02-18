import { createIntegrationTest } from '../utils'

describe('integration', () => {
  test(`cjs-pkg-esm-main-field`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ code, stderr }) => {
        expect(code).toBe(0)

        expect(stderr).toContain(
        'Cannot export `main` field with .mjs extension in CJS package, only .js extension is allowed',
      )
      },
    )
  })
})
