import fs from 'fs'
import path from 'path'
import { createCliTest } from '../../testing-utils'

describe('cli', () => {
  it(`cli no-dts option should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./base.ts', '-o', 'dist/base.js', '--no-dts'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')

        expect(path.basename(distFile)).toBe('base.js')
        expect(fs.existsSync(distFile)).toBe(true)
        expect(fs.existsSync(typeFile)).toBe(false)
        expect(code).toBe(0)
      },
    )
  })
})
