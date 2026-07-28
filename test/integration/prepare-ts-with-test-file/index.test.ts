import { describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration prepare-ts-with-test-file', () => {
  const dir = __dirname
  createJob({
    args: ['prepare'],
    directory: __dirname,
  })
  it('should contain files', async () => {
    assertContainFiles(dir, ['package.json'])
    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )
    expect(pkgJson.files).toContain('dist')
    expect(pkgJson.main).toBe('./dist/index.js')
    expect(pkgJson.module).toBeUndefined()
    expect(Object.keys(pkgJson.exports)).toEqual(['.'])
    expect(Object.keys(pkgJson.exports['.'])).not.toContain('./test')
  })
})
