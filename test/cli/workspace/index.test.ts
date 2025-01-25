import { describe, expect, it } from 'vitest'
import fs from 'fs'
import { runCli } from '../../testing-utils'
import path from 'path'

describe('cli', () => {
  it(`cli workspace should work properly`, async () => {
    const { code, distDir } = await runCli({
      directory: __dirname,
      args: ['./index.ts'],
    })
    const distFile = path.join(distDir, 'index.mjs')

    expect(fs.existsSync(distFile)).toBe(true)
    // CLI does not generate declaration files
    expect(fs.existsSync(distFile.replace('.mjs', '.d.mts'))).toBe(false)
    expect(code).toBe(0)
  })
})
