import fs from 'fs'
import path from 'path'
import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli dts should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./base.ts', '-o', 'dist/base.js'],
      },
      ({ code, distFile }) => {
        expect(path.basename(distFile)).toBe('base.js')
        expect(fs.existsSync(distFile)).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
