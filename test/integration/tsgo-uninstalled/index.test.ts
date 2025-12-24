import { describe, expect, it } from 'vitest'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { runCli } from '../../testing-utils'

describe('integration - tsgo uninstalled', () => {
  it('should error when ts-go is not installed', async () => {
    const { code, stderr } = await runCli({
      directory: __dirname,
      args: ['--tsgo'],
    })

    // Should exit with error code
    expect(code).not.toBe(0)
    const distDir = join(__dirname, 'dist')
    const distFile = join(distDir, './index.js')
    const typeFile = join(distDir, './index.d.ts')

    // Should NOT generate files when ts-go is not available
    expect(existsSync(distFile)).toBe(false)
    expect(existsSync(typeFile)).toBe(false)

    // MUST show error about ts-go not being installed
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
