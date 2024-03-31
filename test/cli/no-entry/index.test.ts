import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli no-entry should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
      },
      ({ code, stderr }) => {
        expect(
          // The "src" directory does not contain any entry files.
          // For proper usage, please refer to the following link:
          // https://github.com/huozhi/bunchee#usage
          stderr.includes(
            'The "src" directory does not contain any entry files.',
          ),
        ).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
