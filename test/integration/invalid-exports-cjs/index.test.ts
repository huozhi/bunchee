import { createIntegrationTest } from '../utils'

describe('integration invalid-exports-cjs', () => {
  it('should warn on invalid exports as CJS', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stderr }) => {
        expect(stderr).toContain('Missing package name')
        expect(stderr).toContain(
          'Cannot export `require` field with .mjs extension in CJS package, only .cjs and .js extensions are allowed',
        )
        expect(stderr).toContain('./dist/index.mjs')
        expect(stderr).toContain(
          'Cannot export `import` field with .js or .cjs extension in CJS package, only .mjs extensions are allowed',
        )
        expect(stderr).toContain('./dist/foo.js')
      },
    )
  })
})
