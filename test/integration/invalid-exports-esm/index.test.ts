import { createIntegrationTest } from '../utils'

describe('integration invalid-exports-esm', () => {
  it('should warn on invalid exports as ESM', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stderr }) => {
        expect(stderr).not.toContain('Missing package name')
        expect(stderr).toContain(
          'Cannot export `require` field with .js or .mjs extension in ESM package, only .cjs extensions are allowed',
        )
        expect(stderr).toContain('./dist/index.js')
        expect(stderr).toContain(
          'Cannot export `import` field with .cjs extension in ESM package, only .js and .mjs extensions are allowed',
        )
        expect(stderr).toContain('./dist/foo.cjs')
      },
    )
  })
})
