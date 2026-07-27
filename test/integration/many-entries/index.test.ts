import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
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

async function build(env: NodeJS.ProcessEnv = {}, args: string[] = []) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', dir, ...args], { env })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return {
    stdout: result.stdout,
    files: await getFileNamesFromDirectory(distDir),
    contents: await getFileContents(distDir),
  }
}

const declarations = (contents: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(contents).filter(([file]) => file.endsWith('.d.ts')),
  )

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

    // Nine entries with a types output each is 18 rollup instances when every
    // entry is built on its own.
    expect(stdout).toMatch(/Building 9 entries in 1 shared rollup instances/)
    expect(stdout).toMatch(
      /Building 9 entries in \d+ worker threads \(\d+ shards of ~\d+\)/,
    )
  }, 120_000)

  it('should emit shared code as one chunk instead of copying it per entry', async () => {
    const perEntry = await build({}, ['--no-merge-entries'])
    const merged = await build()

    // `shared.ts` is not an entry and every entry imports it, so building each
    // entry on its own duplicates it into all nine outputs.
    const copies = Object.entries(perEntry.contents).filter(
      ([file, content]) =>
        file.endsWith('.js') && content.includes(`const shared = 'shared'`),
    )
    expect(copies).toHaveLength(9)

    const chunk = merged.files.find((file) => file.startsWith('shared-'))
    expect(chunk).toBeDefined()
    expect(merged.contents['a.js']).toContain(`from './${chunk}'`)
    expect(merged.contents['a.js']).not.toContain(`const shared = 'shared'`)
  }, 180_000)

  it('should emit the same declarations either way', async () => {
    const perEntry = await build({}, ['--no-merge-entries'])
    const merged = await build()

    expect(declarations(merged.contents)).toEqual(
      declarations(perEntry.contents),
    )
  }, 180_000)

  describe('--no-merge-entries', () => {
    it('should build every entry in its own rollup instance', async () => {
      const { stdout, files, contents } = await build({ DEBUG: '1' }, [
        '--no-merge-entries',
      ])

      expect(stdout).toMatch(/Building 9 entries in \d+ worker threads/)
      expect(stdout).not.toContain('shared rollup instances')
      // No cross-entry chunk: each entry carries its own copy of `shared`.
      expect(files.some((file) => file.startsWith('shared-'))).toBe(false)
      expect(contents['index.js']).toContain(`from './a.js'`)
    }, 120_000)

    it('should produce the same output as an in-process build', async () => {
      const workers = await build({ DEBUG: '1' }, ['--no-merge-entries'])
      const inProcess = await build({ DEBUG: '1', TEST_NO_WORKERS: '1' }, [
        '--no-merge-entries',
      ])

      // Guard the comparison: it only means anything if the first build really
      // did fan out. Runs from source and from dist resolve the worker file
      // differently, so this has to hold for both.
      expect(workers.stdout).toMatch(/Building 9 entries in \d+ worker threads/)
      expect(inProcess.stdout).not.toContain('worker threads')

      expect(inProcess.files).toEqual(workers.files)
      expect(inProcess.contents).toEqual(workers.contents)
    }, 240_000)
  })
})
