import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Nine entries, above MIN_ENTRIES_FOR_WORKERS, with no directive layers: this
// is the fixture that merges every entry into one graph per output. Being over
// the worker threshold, it is also what catches a merged build fanning out to
// workers it cannot profit from. The worker path itself is covered by
// `many-entries-cli`, where a CLI entry file blocks merging.
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
const PROFILE_PREFIX = 'BUNCHEE_PROFILE '

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
        "shared-m31h5ood.js",
      ]
    `)
    // The entry that imports a sibling entry references it instead of inlining
    // it, which rollup resolves itself once both are inputs of one graph.
    expect(contents['index.js']).toContain(`from './a.js'`)
    expect(contents['index.js']).not.toContain(`'a:'`)
  }, 120_000)

  it('should build the JS and the types as one graph each', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    // Nine entries with a types output each would be 18 rollup instances if
    // every entry were built on its own. One graph for the JS, one for the
    // declarations.
    expect(stdout).toMatch(/Building 9 entries in 2 shared rollup instances/)
  }, 120_000)

  it('should not fan out to workers once the entries are merged', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    // A worker cannot start without its own copy of rollup and of the
    // TypeScript compiler API, which costs more than splitting two graphs
    // across threads saves at any entry count measured.
    expect(stdout).not.toContain('worker threads')
  }, 120_000)

  it('should emit structured build profiling when requested', async () => {
    const { stdout } = await build({ PROFILE: '1' })
    const events = stdout
      .split('\n')
      .filter((line) => line.startsWith(PROFILE_PREFIX))
      .map((line) => JSON.parse(line.slice(PROFILE_PREFIX.length)))

    expect(events.length).toBeGreaterThan(0)
    expect(events.every((event) => event.schemaVersion === 1)).toBe(true)
    expect(events.some((event) => event.phase === 'cli.total')).toBe(true)
    expect(events.some((event) => event.phase === 'bundle.total')).toBe(true)
    expect(
      events.some(
        (event) =>
          event.phase === 'rollup.graph' && event.details?.kind === 'js',
      ),
    ).toBe(true)
    expect(
      events.some(
        (event) =>
          event.phase === 'rollup.graph' && event.details?.kind === 'dts',
      ),
    ).toBe(true)
    expect(
      events.filter((event) => event.phase === 'dts.program'),
    ).toHaveLength(1)
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

    // Every entry shares one declaration graph, so this is what catches an
    // entry being dropped from it.
    for (const entry of ENTRIES) {
      expect(contents[`${entry}.d.ts`]).toContain(`declare const ${entry}`)
    }
  }, 120_000)
})
