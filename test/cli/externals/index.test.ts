import fs from 'fs'
import { runCli } from '../../testing-utils'

describe('cli', () => {
  it(`cli external should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: [
        'with-externals.js',
        '-o',
        'dist/with-externals.bundle.js',
        '--external',
        '@huozhi/testing-package',
      ],
    })
    const content = fs.readFileSync(distFile, { encoding: 'utf-8' })

    expect(content.includes('@@test_expected_string@@')).toBe(false)
    expect(content.includes('bar-package')).toBe(true)
    expect(code).toBe(0)
  })

  it(`cli no-externals should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: [
        'with-externals.js',
        '--no-external',
        '-o',
        'dist/with-externals.bundle.js',
      ],
    })
    const content = fs.readFileSync(distFile, { encoding: 'utf-8' })

    expect(content.includes('@@test_expected_string@@')).toBe(true)
    expect(content.includes('bar-package')).toBe(true)
    expect(code).toBe(0)
  })
})
