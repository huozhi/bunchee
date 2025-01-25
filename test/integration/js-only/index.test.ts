import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { createJob, existsFile } from '../../testing-utils'

describe('integration - js-only', () => {
  beforeEach(() => {
    // Mock the 'typescript' module to throw an error on import
    vi.mock('typescript', () => {
      throw new Error('typescript module should not be imported')
    })
  })

  afterEach(() => {
    // Restore the original module and clear mocks after each test
    vi.resetModules() // Reset the module registry to ensure clean state
    vi.clearAllMocks() // Clear mocks after each test
  })

  const { distDir } = createJob({ directory: __dirname })

  it('should work with js only project', async () => {
    const distFile = `${distDir}/index.js`
    expect(await existsFile(distFile)).toBe(true)
  })
})
