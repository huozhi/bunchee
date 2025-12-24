import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { runCli } from '../../testing-utils'

describe('integration - tsgo uninstalled', () => {
  it('should warn when ts-go is not installed and fallback to regular TypeScript', async () => {
    const { code, stderr } = await runCli({
      directory: __dirname,
      args: ['--experimental-tsgo'],
    })

    expect(code).toBe(0)
    const distDir = join(__dirname, 'dist')
    const distFile = join(distDir, './index.js')
    const typeFile = join(distDir, './index.d.ts')

    // Should still generate files (fallback to regular TypeScript)
    expect(existsSync(distFile)).toBe(true)
    expect(existsSync(typeFile)).toBe(true)

    // MUST show warning about ts-go not being installed
    // Check for all possible warning messages
    const hasWarning =
      stderr.includes('Could not load TypeScript-Go compiler') ||
      stderr.includes('TypeScript-Go compiler not found') ||
      stderr.includes(
        '--experimental-tsgo flag was specified but @typescript/native-preview is not installed',
      )

    expect(hasWarning).toBe(true)
    expect(stderr).toMatch(/TypeScript-Go|@typescript\/native-preview/)

    // Verify the type file was generated correctly
    // rollup-plugin-dts may transform the output, so check for interface/function names
    const typeContent = readFileSync(typeFile, 'utf-8')
    expect(typeContent).toMatch(/interface\s+User|export\s+interface\s+User/)
    expect(typeContent).toMatch(/function\s+greet|export\s+function\s+greet/)
  })
})
