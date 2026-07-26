import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  getFileNamesFromDirectory,
  removeDirectory,
  stripANSIColor,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Nine entries, so the build fans out to workers, and the `.` export has no
// src/index.ts behind it — it exists only because an entry file is passed on
// the command line. A worker that does not replay that entry path resolves a
// different entries map than the main thread listed, and silently builds
// nothing for the entry it was assigned.
const dir = __dirname
const distDir = path.join(dir, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['./src/custom-entry.ts', '--cwd', dir], {
    env,
  })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return {
    files: await getFileNamesFromDirectory(distDir),
    // The size table is colorized whenever picocolors thinks the terminal
    // supports it, which includes any environment setting CI.
    stdout: stripANSIColor(result.stdout),
  }
}

describe('integration - many-entries-cli', () => {
  afterAll(async () => {
    if (!process.env.TEST_NOT_CLEANUP) {
      await removeDirectory(distDir)
    }
  })

  it('should build the entry file passed on the command line', async () => {
    const { files, stdout } = await build()

    expect(files).toContain('index.d.ts')
    // The `.` export is reported, not dropped on the floor.
    expect(stdout).toMatch(/^\.\s+dist\/index\.d\.ts/m)
  }, 120_000)

  it('should produce the same output as an in-process build', async () => {
    const workers = await build()
    const inProcess = await build({ TEST_NO_WORKERS: '1' })

    expect(inProcess.files).toEqual(workers.files)
  }, 240_000)
})
