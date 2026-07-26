import { describe, expect, it } from 'vitest'
import {
  assertContainFiles,
  createJob,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration wildcard-patterns', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should expand wildcards that are not a whole trailing segment', async () => {
    // `./feat-*` — wildcard prefixed within a segment
    // `./*/utils` — wildcard followed by a suffix
    // `./features/*` — wildcard matching across `/`
    await assertContainFiles(distDir, [
      'index.js',
      'feat-alpha.js',
      'feat-beta.js',
      'features/flat.js',
      'features/nested/inner/deep.js',
      'alpha/utils.js',
      'beta/utils.js',
    ])
  })

  it('should not expand private modules into public wildcard exports', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    // `_private.ts` is a shared module, so it is still emitted, but it must not
    // be treated as the `./features/_private` subpath export.
    expect(files).not.toContain('features/_private/index.js')
  })

  it('should not emit a bundle per wildcard segment prefix', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    // Regression: `./feat-*` used to resolve to the bogus export `./feat-/feat-alpha`
    expect(files.filter((f) => f.startsWith('feat-/'))).toEqual([])
    // Regression: `./*/utils` used to collapse to `./alpha` / `./beta`
    expect(files).not.toContain('alpha.js')
    expect(files).not.toContain('beta.js')
  })
})
