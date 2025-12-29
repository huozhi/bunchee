import { describe, expect, it } from 'vitest'
import { promises as fsp } from 'fs'
import { join } from 'path'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration wildcard-exports', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for wildcard exports', async () => {
    const distFiles = ['index.js', 'features/foo.js', 'features/bar.js']
    await assertContainFiles(distDir, distFiles)

    const fooFile = await fsp.readFile(join(distDir, 'features/foo.js'), {
      encoding: 'utf-8',
    })
    expect(fooFile).toContain('foo feature')

    const barFile = await fsp.readFile(join(distDir, 'features/bar.js'), {
      encoding: 'utf-8',
    })
    expect(barFile).toContain('bar feature')
  })
})
