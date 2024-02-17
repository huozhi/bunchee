import fs from 'fs'
import { createCliTest } from '../utils'
import path from 'path'

describe('cli', () => {
  it(`cli workspace should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./index.ts'],
      },
      ({ code, distDir }) => {
        const distFile = path.join(distDir, 'index.mjs')

        expect(fs.existsSync(distFile)).toBe(true)
        expect(fs.existsSync(distFile.replace('.mjs', '.d.ts'))).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
