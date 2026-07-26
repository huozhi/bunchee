import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Nine entries, above MIN_ENTRIES_FOR_WORKERS, with no directive layers: this
// is the fixture that takes the worker pool path.
const dir = __dirname
const distDir = path.join(dir, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', dir], { env })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return {
    stdout: result.stdout,
    files: await getFileNamesFromDirectory(distDir),
    contents: await getFileContents(distDir),
  }
}

describe('integration - many-entries', () => {
  afterAll(async () => {
    if (!process.env.TEST_NOT_CLEANUP) {
      await removeDirectory(distDir)
    }
  })

  it('should build every entry', async () => {
    const { files, contents } = await build()

    expect(files).toMatchInlineSnapshot(`
      [
        "a.d.ts",
        "a.js",
        "b.d.ts",
        "b.js",
        "c.d.ts",
        "c.js",
        "d.d.ts",
        "d.js",
        "e.d.ts",
        "e.js",
        "f.d.ts",
        "f.js",
        "g.d.ts",
        "g.js",
        "h.d.ts",
        "h.js",
        "index.d.ts",
        "index.js",
      ]
    `)
    // The entry that imports a sibling entry keeps it external instead of
    // inlining it, which the worker has to get right from its own copy of the
    // full entries map.
    expect(contents['index.js']).toContain(`from './a.js'`)
    expect(contents['index.js']).not.toContain(`'a:'`)
  }, 120_000)

  it('should produce the same output as an in-process build', async () => {
    const workers = await build({ DEBUG: '1' })
    const inProcess = await build({ DEBUG: '1', TEST_NO_WORKERS: '1' })

    // Guard the comparison: it only means anything if the first build really
    // did fan out. Runs from source and from dist resolve the worker file
    // differently, so this has to hold for both.
    expect(workers.stdout).toMatch(/Building 9 entries in \d+ worker threads/)
    expect(inProcess.stdout).not.toContain('worker threads')

    expect(inProcess.files).toEqual(workers.files)
    expect(inProcess.contents).toEqual(workers.contents)
  }, 240_000)
})
