import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { findReachablePrivateFiles, normalizeExportPath } from './entries'

describe('normalizeExportPath', () => {
  it('should strip export condition suffixes', () => {
    expect(normalizeExportPath('./index')).toBe('.')
    expect(normalizeExportPath('./index.development')).toBe('.')
    expect(normalizeExportPath('./index.react-server')).toBe('.')
    expect(normalizeExportPath('./shared')).toBe('./shared')
    expect(normalizeExportPath('./shared.development')).toBe('./shared')
  })

  it('should strip stacked condition suffixes', () => {
    expect(normalizeExportPath('./index.development.react-server')).toBe('.')
    expect(normalizeExportPath('./shared.production.node')).toBe('./shared')
  })

  it('should keep dots that are part of the subpath', () => {
    // Regression: these used to be truncated to `./v1` and `./charts`, because
    // everything after the first dot was assumed to be a condition.
    expect(normalizeExportPath('./v1.2/thing')).toBe('./v1.2/thing')
    expect(normalizeExportPath('./charts.min')).toBe('./charts.min')
    expect(normalizeExportPath('./foo.bar')).toBe('./foo.bar')
  })

  it('should leave binary paths alone', () => {
    expect(normalizeExportPath('$binary')).toBe('$binary')
    expect(normalizeExportPath('$binary/index')).toBe('$binary')
    expect(normalizeExportPath('$binary/foo')).toBe('$binary/foo')
  })
})

describe('findReachablePrivateFiles', () => {
  const created: string[] = []

  afterEach(() => {
    while (created.length)
      rmSync(created.pop()!, { recursive: true, force: true })
  })

  /** Writes `files` into a throwaway `src` directory, keyed by relative path. */
  function writeSrc(files: Record<string, string>): string {
    const root = mkdtempSync(path.join(tmpdir(), 'bunchee-reachable-'))
    created.push(root)
    const sourceFolder = path.join(root, 'src')
    for (const [file, code] of Object.entries(files)) {
      const target = path.join(sourceFolder, file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, code)
    }
    return sourceFolder
  }

  /** The private files kept, given which of them are private and which are entries. */
  async function reachable(
    files: Record<string, string>,
    privateFiles: string[],
    entries: string[],
  ): Promise<string[]> {
    const sourceFolder = writeSrc(files)
    const kept = await findReachablePrivateFiles(
      sourceFolder,
      privateFiles,
      entries.map((entry) => path.join(sourceFolder, entry)),
    )
    return [...kept].sort()
  }

  it('should keep a private module an export imports', async () => {
    expect(
      await reachable(
        {
          'index.ts': `export { util } from './_util'`,
          '_util.ts': `export const util = 1`,
        },
        ['_util.ts'],
        ['index.ts'],
      ),
    ).toEqual(['_util.ts'])
  })

  it('should skip a private module no export reaches', async () => {
    // The case this exists for: a build-time script sitting in `src`, which
    // nothing imports and whose own imports should not enter the graph.
    expect(
      await reachable(
        {
          'index.ts': `export const index = 1`,
          '_build.ts': `import ts from 'typescript'\nexport const build = ts`,
        },
        ['_build.ts'],
        ['index.ts'],
      ),
    ).toEqual([])
  })

  it('should reach a private module through another module', async () => {
    expect(
      await reachable(
        {
          'index.ts': `export { a } from './middle'`,
          'middle.ts': `export { a } from './_deep'`,
          '_deep.ts': `export const a = 1`,
          '_orphan.ts': `export const b = 2`,
        },
        ['_deep.ts', '_orphan.ts'],
        ['index.ts'],
      ),
    ).toEqual(['_deep.ts'])
  })

  it('should resolve a private directory to its index', async () => {
    // `'../_internal'` names a directory, which exists — so a check that only
    // asked whether the path existed would stop before reaching `index.ts` and
    // never walk what it imports.
    expect(
      await reachable(
        {
          'index/index.ts': `export { internal } from '../_internal'`,
          '_internal/index.ts': `export { helper as internal } from './_helper'`,
          '_internal/_helper.ts': `export const helper = 1`,
        },
        ['_internal/index.ts', '_internal/_helper.ts'],
        ['index/index.ts'],
      ),
    ).toEqual(['_internal/_helper.ts', '_internal/index.ts'])
  })

  it('should keep every condition variant when one is reached', async () => {
    // The variants are alternative sources for one export path, and which one an
    // importer means depends on the condition being built.
    expect(
      await reachable(
        {
          'index.react-server.ts': `export { internal } from './_internal/index.react-server'`,
          '_internal/index.react-server.ts': `export const internal = 'rsc'`,
          '_internal/index.ts': `export const internal = 'default'`,
        },
        ['_internal/index.react-server.ts', '_internal/index.ts'],
        ['index.react-server.ts'],
      ),
    ).toEqual(['_internal/index.react-server.ts', '_internal/index.ts'].sort())
  })

  it('should keep a private module named through the package name', async () => {
    // A self-reference resolves through the package's own exports, so nothing on
    // disk answers the specifier — but it still spells the module's name.
    expect(
      await reachable(
        {
          'index.ts': `export { internal } from 'pkg/_internal'`,
          '_internal/index.ts': `export const internal = 1`,
        },
        ['_internal/index.ts'],
        ['index.ts'],
      ),
    ).toEqual(['_internal/index.ts'])
  })

  it('should not treat an import inside a string as an import', async () => {
    // The entry generates code, so it holds an import statement in a literal.
    // Reading that as its own is how a file appears to reach what it does not —
    // and `_target` exists, so the specifier resolves and the mistake sticks.
    expect(
      await reachable(
        {
          'index.ts': "export const template = `import { x } from './_target'`",
          '_target.ts': `export const x = 1`,
        },
        ['_target.ts'],
        ['index.ts'],
      ),
    ).toEqual([])
  })

  it('should keep everything when a specifier is computed', async () => {
    expect(
      await reachable(
        {
          'index.ts': `export const load = (n: string) => import('./' + n)`,
          '_a.ts': `export const a = 1`,
          '_b.ts': `export const b = 2`,
        },
        ['_a.ts', '_b.ts'],
        ['index.ts'],
      ),
    ).toEqual(['_a.ts', '_b.ts'])
  })

  it('should keep everything when a file cannot be parsed', async () => {
    expect(
      await reachable(
        {
          'index.ts': `this is not ( valid ] typescript <<<`,
          '_a.ts': `export const a = 1`,
        },
        ['_a.ts'],
        ['index.ts'],
      ),
    ).toEqual(['_a.ts'])
  })
})
