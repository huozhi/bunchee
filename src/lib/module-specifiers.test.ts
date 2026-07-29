import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  collectSpecifiers,
  resolveSpecifierToSourceFile,
} from './module-specifiers'

describe('collectSpecifiers', () => {
  /** The modules `code` names, given the extension it is written in. */
  function named(code: string, ext = 'ts'): string[] | null {
    const found = collectSpecifiers(code, `/pkg/src/index.${ext}`)
    return found && found.specifiers
  }

  it('should collect every static form', () => {
    expect(
      named(
        [
          `import a from './a'`,
          `import './side-effect'`,
          `export * from './b'`,
          `export { c } from './c'`,
          `import type { T } from './t'`,
          `export type { U } from './u'`,
          `import x = require('./legacy')`,
        ].join('\n'),
      ),
    ).toEqual(['./a', './side-effect', './b', './c', './t', './u', './legacy'])
  })

  it('should collect a dynamic import wherever it appears', () => {
    // Nested inside a function body, which is why the whole tree is walked
    // rather than only the top-level statements.
    const found = collectSpecifiers(
      `export function load() { return import('./lazy') }`,
      '/pkg/src/index.ts',
    )
    expect(found?.specifiers).toEqual(['./lazy'])
    expect(found?.hasComputedSpecifier).toBe(false)
  })

  it('should report a computed specifier rather than guess at it', () => {
    const found = collectSpecifiers(
      `export const load = (n: string) => import('./' + n)`,
      '/pkg/src/index.ts',
    )
    expect(found?.hasComputedSpecifier).toBe(true)
  })

  it('should not collect an import written inside a string', () => {
    // A module that generates code holds import statements in its literals.
    expect(named("export const t = `import { x } from './target'`")).toEqual([])
    expect(named(`// import { x } from './commented'`)).toEqual([])
  })

  it('should not be confused by TypeScript that looks like other syntax', () => {
    // A generic arrow parsed as JSX fails, and a regex holding a quote looks
    // like the start of a specifier.
    expect(named(`const f = <T,>(x: T) => x\nimport { a } from './a'`)).toEqual(
      ['./a'],
    )
    expect(named(`const r = /['"]/g\nimport { a } from './a'`)).toEqual(['./a'])
    expect(named(`enum E { A }\nimport { a } from './a'`)).toEqual(['./a'])
  })

  it('should read JSX in the extensions that carry it', () => {
    const jsx = `import { a } from './a'\nexport const C = () => <div p="x">{'</div>'}</div>`
    expect(named(jsx, 'tsx')).toEqual(['./a'])
    expect(named(jsx, 'jsx')).toEqual(['./a'])
  })

  it('should return null for code it cannot parse', () => {
    // Distinct from `[]`: a caller has to tell "names nothing" from "unknown".
    expect(
      collectSpecifiers(`this is not ( valid ] <<<`, '/pkg/src/index.ts'),
    ).toBeNull()
  })
})

describe('resolveSpecifierToSourceFile', () => {
  const created: string[] = []

  afterEach(() => {
    while (created.length)
      rmSync(created.pop()!, { recursive: true, force: true })
  })

  function writeFiles(files: string[]): string {
    const root = mkdtempSync(path.join(tmpdir(), 'bunchee-specifier-'))
    created.push(root)
    for (const file of files) {
      const target = path.join(root, file)
      mkdirSync(path.dirname(target), { recursive: true })
      writeFileSync(target, '')
    }
    return root
  }

  /** What `specifier` written in `<root>/index.ts` resolves to, relative again. */
  function resolve(files: string[], specifier: string): string | undefined {
    const root = writeFiles(files)
    const resolved = resolveSpecifierToSourceFile(
      path.join(root, 'index.ts'),
      specifier,
    )
    return resolved && path.relative(root, resolved)
  }

  it('should add a source extension', () => {
    expect(resolve(['util.ts'], './util')).toBe('util.ts')
    expect(resolve(['util.tsx'], './util')).toBe('util.tsx')
  })

  it('should resolve a directory to its index', () => {
    // The directory itself exists, so anything checking only for existence
    // would stop here and never reach the file.
    expect(resolve(['internal/index.ts'], './internal')).toBe(
      path.join('internal', 'index.ts'),
    )
  })

  it('should map a declared output extension back to source', () => {
    // TypeScript source imports a sibling by the extension it will be built to.
    expect(resolve(['util.ts'], './util.js')).toBe('util.ts')
    expect(resolve(['util.mts'], './util.mjs')).toBe('util.mts')
  })

  it('should resolve a file that is already spelled exactly', () => {
    expect(resolve(['util.ts'], './util.ts')).toBe('util.ts')
  })

  it('should not resolve a bare specifier', () => {
    // It names a package, not a file, even where a same-named file exists.
    expect(resolve(['react.ts'], 'react')).toBeUndefined()
    expect(resolve(['internal/index.ts'], 'pkg/internal')).toBeUndefined()
  })

  it('should not resolve what is not there', () => {
    expect(resolve(['util.ts'], './missing')).toBeUndefined()
  })
})
