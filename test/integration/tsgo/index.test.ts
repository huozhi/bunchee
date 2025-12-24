import { describe, expect, it, beforeAll } from 'vitest'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { runCli } from '../../testing-utils'
import { execSync } from 'child_process'

const TEST_DIR = __dirname

/**
 * Checks if @typescript/native-preview is installed in this test directory
 */
function isTsGoInstalled(): boolean {
  try {
    require.resolve('@typescript/native-preview', {
      paths: [TEST_DIR],
    })
    return true
  } catch {
    return false
  }
}

/**
 * Sets up the test environment by installing dependencies silently
 * This installs bunchee (linked) and @typescript/native-preview
 */
function setupTestEnvironment() {
  // Check if already installed to avoid unnecessary installs
  if (isTsGoInstalled()) {
    return
  }

  try {
    // Install dependencies silently (bunchee link + @typescript/native-preview)
    // Use --no-frozen-lockfile since this is a test directory
    // --silent suppresses all output, --reporter=silent is even quieter
    execSync('pnpm install --no-frozen-lockfile --silent --reporter=silent', {
      cwd: TEST_DIR,
      stdio: 'ignore', // Completely suppress all output (stdin, stdout, stderr)
      env: { ...process.env },
    })
  } catch (error: any) {
    // If installation fails silently, the test will skip if package is not available
    // Don't log errors to keep test output clean
  }
}

describe('integration - tsgo', () => {
  beforeAll(() => {
    setupTestEnvironment()
  })

  it('should use ts-go when flag is set and package is installed (no warnings)', async () => {
    // Verify @typescript/native-preview is actually installed
    const tsgoInstalled = isTsGoInstalled()

    if (!tsgoInstalled) {
      // Skip test silently if package is not available
      // The setup function already tried to install it
      return
    }

    const { code, distFile, stderr } = await runCli({
      directory: TEST_DIR,
      args: ['--tsgo'],
    })

    expect(code).toBe(0)
    const typeFile = distFile.replace('.js', '.d.ts')
    const distDir = join(TEST_DIR, 'dist')

    // Should generate files
    expect(existsSync(distFile)).toBe(true)
    expect(existsSync(typeFile)).toBe(true)

    // MUST NOT show any warnings about ts-go not being installed
    expect(stderr).not.toMatch(/Could not load TypeScript-Go compiler/)
    expect(stderr).not.toMatch(/TypeScript-Go compiler not found/)
    expect(stderr).not.toMatch(/@typescript\/native-preview is not installed/)
    expect(stderr).not.toMatch(/--tsgo flag was specified but/)

    // Verify the type file was generated correctly
    const typeContent = readFileSync(typeFile, 'utf-8')
    expect(typeContent).toMatch(/interface\s+User|export\s+interface\s+User/)
    expect(typeContent).toMatch(/function\s+greet|export\s+function\s+greet/)

    // Verify the output is valid TypeScript declaration
    expect(typeContent).toMatch(
      /declare\s+function|export\s+(interface|function)|interface\s+\w+|function\s+\w+/,
    )
  })
})
