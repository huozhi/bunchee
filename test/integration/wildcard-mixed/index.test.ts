import { describe, expect, it } from 'vitest'
import { promises as fsp } from 'fs'
import { join } from 'path'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration wildcard-mixed', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for mixed wildcard and normal exports', async () => {
    const distFiles = [
      'index.js',
      'utils.js',
      'lite.js',
      'features/foo.js',
      'features/bar.js',
      'components/button.js',
      'components/input.js',
    ]
    await assertContainFiles(distDir, distFiles)

    // Verify normal exports
    const indexFile = await fsp.readFile(join(distDir, 'index.js'), {
      encoding: 'utf-8',
    })
    expect(indexFile).toContain('main export')

    const utilsFile = await fsp.readFile(join(distDir, 'utils.js'), {
      encoding: 'utf-8',
    })
    expect(utilsFile).toContain('utils')

    const liteFile = await fsp.readFile(join(distDir, 'lite.js'), {
      encoding: 'utf-8',
    })
    expect(liteFile).toContain('lite')

    // Verify wildcard exports
    const fooFile = await fsp.readFile(join(distDir, 'features/foo.js'), {
      encoding: 'utf-8',
    })
    expect(fooFile).toContain('foo feature')

    const barFile = await fsp.readFile(join(distDir, 'features/bar.js'), {
      encoding: 'utf-8',
    })
    expect(barFile).toContain('bar feature')

    // Verify another wildcard pattern
    const buttonFile = await fsp.readFile(
      join(distDir, 'components/button.js'),
      {
        encoding: 'utf-8',
      },
    )
    expect(buttonFile).toContain('button component')

    const inputFile = await fsp.readFile(join(distDir, 'components/input.js'), {
      encoding: 'utf-8',
    })
    expect(inputFile).toContain('input component')
  })

  it('should handle overlap between normal export and wildcard export', async () => {
    // ./features/foo is defined as both a normal export and matches the wildcard pattern
    // The normal export should be processed first, then the wildcard expansion
    // Both should result in the same output file, which is fine

    // Verify that foo (defined as both normal and wildcard) works
    const fooFile = await fsp.readFile(join(distDir, 'features/foo.js'), {
      encoding: 'utf-8',
    })
    expect(fooFile).toContain('foo feature')

    // Verify that bar (only in wildcard) still works
    const barFile = await fsp.readFile(join(distDir, 'features/bar.js'), {
      encoding: 'utf-8',
    })
    expect(barFile).toContain('bar feature')

    // Both files should exist
    await assertContainFiles(distDir, ['features/foo.js', 'features/bar.js'])
  })
})
