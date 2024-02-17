import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli no-entry should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
      },
      ({ code, stderr }) => {
        expect(
          stderr.includes(
            'The "src" directory does not contain any entry files.',
          ),
        ).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
