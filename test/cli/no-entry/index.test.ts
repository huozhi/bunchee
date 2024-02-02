import { createCliTest, removeDirectory } from '../utils'

describe('cli', () => {
  it(`cli no-entry should work properly`, async () => {
    const { code, distDir, stderr } = await createCliTest({
      directory: __dirname,
    })

    expect(
      stderr.includes('The "src" directory does not contain any entry files.'),
    ).toBe(true)
    expect(code).toBe(0)

    await removeDirectory(distDir)
  })
})
