import { createCliJob } from '../../testing-utils'

test(`cli no-entry should work properly`, async () => {
  const { code, stderr } = await createCliJob({
    directory: __dirname,
  })
  expect(
    // The "src" directory does not contain any entry files.
    // For proper usage, please refer to the following link:
    // https://github.com/huozhi/bunchee#usage
    stderr.includes('The "src" directory does not contain any entry files.'),
  ).toBe(true)
  expect(code).toBe(0)
})
