import { createIntegrationTest } from '../../testing-utils'

describe('integration - conflicted-entry', () => {
  it('should error on conflicted entries', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ code, stderr }) => {
        expect(code).toBe(1)
        expect(stderr).toContain(
          'Conflicted entry files found for entries: ./foo',
        )
      },
    )
  })
})
