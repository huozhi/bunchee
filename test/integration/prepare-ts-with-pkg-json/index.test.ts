import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createJob, deleteFile } from '../../testing-utils'

describe('integration prepare-ts-with-pkg-json', () => {
  const dir = __dirname
  beforeAll(async () => {
    await fsp.writeFile(
      join(dir, './package.json'),
      '{ "name": "prepare-ts-with-pkg-json" }',
    )
    await deleteFile(join(dir, './tsconfig.json'))
  })

  createJob({
    directory: __dirname,
    args: ['prepare'],
  })

  it('should contain files', async () => {
    assertContainFiles(dir, ['package.json'])
    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )
    expect(pkgJson.files).toContain('dist')
    expect(pkgJson.type).toBeUndefined()
    expect(pkgJson.main).toBe('./dist/cjs/index.js')
    expect(pkgJson.module).toBe('./dist/es/index.mjs')
  })
})
