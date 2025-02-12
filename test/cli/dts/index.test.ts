import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runCli } from '../../testing-utils'

describe('cli', () => {
  it(`cli dts should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['./input.ts', '-o', 'dist/output.js'],
    })
    const typeFile = distFile.replace('.js', '.d.ts')

    expect(path.basename(distFile)).toBe('output.js')
    expect(path.basename(typeFile)).toBe('output.d.ts')
    expect(fs.existsSync(distFile)).toBe(true)
    expect(fs.existsSync(typeFile)).toBe(true)
    expect(code).toBe(0)
  })
})
