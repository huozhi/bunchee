import { createIntegrationTest } from '../../testing-utils'

describe('integration js-bad-configured-types', () => {
  it('should error when types is not correctly configured', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stderr, code }) => {
        expect(code).toBe(0)

        expect(stderr).toContain(
          `Bad export types field with import.require in ./dist/index.d.mts, use "types" export condition for it`,
        )
        expect(stderr).toContain(
          `Bad export types field with require in ./dist/index.d.ts, use "types" export condition for it`,
        )
      },
    )
  })
})
