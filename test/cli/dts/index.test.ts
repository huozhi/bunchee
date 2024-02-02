import fs from 'fs'
import path from 'path'
import { createCliTest, removeDirectory } from '../utils'

describe('cli', () => {
  it(`cli dts should work properly`, async () => {
    const { code, distDir, distFile } = await createCliTest({
      directory: __dirname,
      args: ['./base.ts', '-o', 'dist/base.js'],
    })

    const typeFile = distFile.replace('.js', '.d.ts')

    expect(path.basename(distFile)).toBe('base.js')
    expect(path.basename(typeFile)).toBe('base.d.ts')
    expect(fs.existsSync(distFile)).toBe(true)
    expect(fs.existsSync(typeFile)).toBe(true)
    expect(code).toBe(0)

    await removeDirectory(distDir)
  })
})
