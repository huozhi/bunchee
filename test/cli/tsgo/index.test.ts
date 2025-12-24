import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runCli } from '../../testing-utils'

describe('cli tsgo', () => {
  it('should warn when ts-go is not installed', async () => {
    const { code, distFile, stderr } = await runCli({
      directory: __dirname,
      args: ['./input.ts', '-o', 'dist/output.js', '--experimental-tsgo'],
    })
    const typeFile = distFile.replace('.js', '.d.ts')

    expect(code).toBe(0)
    expect(path.basename(distFile)).toBe('output.js')
    expect(path.basename(typeFile)).toBe('output.d.ts')
    expect(fs.existsSync(distFile)).toBe(true)
    expect(fs.existsSync(typeFile)).toBe(true)

    // MUST show warnings when ts-go is NOT installed
    const hasWarning =
      stderr.includes('Could not load TypeScript-Go compiler') ||
      stderr.includes('TypeScript-Go compiler not found') ||
      stderr.includes(
        '--experimental-tsgo flag was specified but @typescript/native-preview is not installed',
      )
    expect(hasWarning).toBe(true)
    expect(stderr).toMatch(/TypeScript-Go|@typescript\/native-preview/)

    // Verify type file content
    const typeContent = fs.readFileSync(typeFile, 'utf-8')
    expect(typeContent).toMatch(
      /function\s+(add|multiply)|export\s+function|declare\s+function/,
    )
  })
})
