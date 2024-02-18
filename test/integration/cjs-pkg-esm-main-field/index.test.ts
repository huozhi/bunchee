import { createIntegrationTest } from '../utils'

describe('integration cjs-pkg-esm-main-field', () => {
  it('should warn if main field with .mjs extension in CJS package', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ stderr }) => {
        expect(stderr).toContain(
          'Cannot export `main` field with .mjs extension in CJS package, only .js extension is allowed',
        )
      },
    )
  })
})
