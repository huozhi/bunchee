import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createJob, deleteFile } from '../../testing-utils'

describe('integration prepare-ts-with-test-file', () => {
  const dir = __dirname
  beforeAll(async () => {
    await deleteFile(join(dir, './package.json'))
    await deleteFile(join(dir, './tsconfig.json'))
  })
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
    expect(pkgJson.main).toBe('./dist/es/index.js')
    expect(pkgJson.module).toBe('./dist/es/index.js')
    expect(Object.keys(pkgJson.exports)).toEqual(['.'])
    expect(Object.keys(pkgJson.exports['.'])).not.toContain('./test')
  })
})
