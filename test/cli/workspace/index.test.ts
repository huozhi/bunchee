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
        // CLI does not generate declaration files
        expect(fs.existsSync(distFile.replace('.mjs', '.d.mts'))).toBe(false)
        expect(code).toBe(0)
      },
    )
  })
})
