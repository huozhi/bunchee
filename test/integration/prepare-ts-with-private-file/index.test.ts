import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createJob, deleteFile } from '../../testing-utils'

describe('integration prepare-ts-with-private-file', () => {
  const dir = __dirname
  beforeAll(async () => {
    await deleteFile(join(dir, './package.json'))
    await deleteFile(join(dir, './tsconfig.json'))
  })
  createJob({
    args: ['prepare'],
    directory: __dirname,
  })
  it('should not expose private shared modules as exports', async () => {
    assertContainFiles(dir, ['package.json'])
    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )
    // Underscore-prefixed files and directories are shared modules, not entries.
    // Regression: `_shared.ts` and `lib/_helper.ts` used to be written out as
    // public subpath exports, since the ignore glob only matched directories.
    expect(Object.keys(pkgJson.exports).sort()).toEqual(['.', './lib/pub'])
  })
})
