import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Nine entries, above MIN_ENTRIES_FOR_WORKERS, with no directive layers: this
// is the fixture that merges the JS into one graph and shards the types.
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

const ENTRIES = ['index', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('integration - many-entries', () => {
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
        "shared-BMJTKie0.js",
      ]
    `)
    // The entry that imports a sibling entry references it instead of inlining
    // it, which rollup resolves itself once both are inputs of one graph.
    expect(contents['index.js']).toContain(`from './a.js'`)
    expect(contents['index.js']).not.toContain(`'a:'`)
  }, 120_000)

  it('should build the JS as one graph and shard the types', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    // Nine entries with a types output each would be 18 rollup instances if
    // every entry were built on its own.
    expect(stdout).toMatch(/Building 9 entries in 1 shared rollup instances/)
    expect(stdout).toMatch(
      /Building 9 entries in \d+ worker threads \(\d+ shards of ~\d+\)/,
    )
  }, 120_000)

  it('should emit code shared between entries as a single chunk', async () => {
    const { files, contents } = await build()

    // `shared.ts` is not an entry and all nine entries import it, so it lands
    // in one chunk that every entry references rather than a copy per entry.
    const chunks = files.filter((file) => file.startsWith('shared-'))
    expect(chunks).toHaveLength(1)

    for (const entry of ENTRIES) {
      expect(contents[`${entry}.js`]).toContain(`from './${chunks[0]}'`)
      expect(contents[`${entry}.js`]).not.toContain(`const shared = 'shared'`)
    }
    expect(contents[chunks[0]]).toContain(`const shared = 'shared'`)
  }, 120_000)

  it('should emit a declaration file per entry', async () => {
    const { contents } = await build()

    // The types are sharded across workers, so this is what catches a shard
    // dropping the entries it was handed.
    for (const entry of ENTRIES) {
      expect(contents[`${entry}.d.ts`]).toContain(`declare const ${entry}`)
    }
  }, 120_000)

  it('should produce the same output as an in-process build', async () => {
    const workers = await build({ DEBUG: '1' })
    const inProcess = await build({ DEBUG: '1', TEST_NO_WORKERS: '1' })

    // Guard the comparison: it only means anything if the first build really
    // did fan out. Runs from source and from dist resolve the worker file
    // differently, so this has to hold for both.
    expect(workers.stdout).toMatch(/Building 9 entries in \d+ worker threads/)
    expect(inProcess.stdout).not.toContain('worker threads')

    // Types sharded across workers against one merged graph in this process.
    expect(inProcess.files).toEqual(workers.files)
    expect(inProcess.contents).toEqual(workers.contents)
  }, 240_000)
})
