import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { getFileNamesFromDirectory, removeDirectory } from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Nine entries, so above MIN_ENTRIES_FOR_WORKERS, but with 'use client' and
// 'use server' directives. Chunk splitting for layered modules depends on
// state shared between every entry's build, so this package has to fall back
// to the in-process path — a worker would only ever see one entry's modules
// and would stop splitting the shared module out.
const dir = __dirname
const distDir = path.join(dir, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', dir], {
    env: { ...env, DEBUG: '1' },
  })
  expect(result.code).toBe(0)
  // The directive gate has to keep this package off the worker pool whatever
  // its entry count is.
  expect(result.stdout).not.toContain('worker threads')
  return getFileNamesFromDirectory(distDir)
}

describe('integration - many-entries-directives', () => {
  afterAll(async () => {
    if (!process.env.TEST_NOT_CLEANUP) {
      await removeDirectory(distDir)
    }
  })

  it('should keep the layered shared modules in their own chunks', async () => {
    const files = await build()

    expect(files).toEqual(
      expect.arrayContaining([
        'client.js',
        'server.js',
        'lib/_app-context.js',
        'lib/_util.js',
      ]),
    )
  }, 120_000)

  it('should build identically with workers disabled', async () => {
    // The directive gate should already have taken this package off the
    // worker path, so forcing it off must not change anything.
    const gated = await build()
    const forced = await build({ TEST_NO_WORKERS: '1' })

    expect(forced).toEqual(gated)
  }, 240_000)
})
