import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runCli } from '../../testing-utils'

describe('cli tsgo', () => {
  it('should error when ts-go is not installed', async () => {
    const { code, stderr } = await runCli({
      directory: __dirname,
      args: ['./input.ts', '-o', 'dist/output.js', '--tsgo'],
    })

    // Should exit with error code
    expect(code).not.toBe(0)

    // Should NOT generate files when ts-go is not available
    const distFile = path.join(__dirname, 'dist', 'output.js')
    const typeFile = path.join(__dirname, 'dist', 'output.d.ts')
    expect(fs.existsSync(distFile)).toBe(false)
    expect(fs.existsSync(typeFile)).toBe(false)

    // MUST show error when ts-go is NOT installed
    const hasError =
      stderr.includes('TypeScript-Go compiler not found') ||
      stderr.includes(
        '--tsgo flag was specified but @typescript/native-preview is not installed',
      ) ||
      stderr.includes('@typescript/native-preview')
    expect(hasError).toBe(true)
    expect(stderr).toMatch(/TypeScript-Go|@typescript\/native-preview/)
  })
})
