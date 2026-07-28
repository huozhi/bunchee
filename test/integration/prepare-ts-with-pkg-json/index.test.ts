import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration prepare-ts-with-pkg-json', () => {
  const dir = __dirname

  describe('with no exports', () => {
    beforeAll(async () => {
      await fsp.writeFile(
        join(dir, './package.json'),
        JSON.stringify({ name: 'prepare-ts-with-pkg-json' }, null, 2),
      )
    })
    createJob({
      directory: __dirname,
      args: ['prepare', '--cjs'],
    })
    it('should contain output files', async () => {
      assertContainFiles(dir, ['package.json'])
      const pkgJson = JSON.parse(
        await fsp.readFile(join(dir, './package.json'), 'utf-8'),
      )
      expect(pkgJson.files).toContain('dist')
      expect(pkgJson.type).toBeUndefined()
      expect(pkgJson.main).toBe('./dist/cjs/index.js')
      expect(pkgJson.module).toBeUndefined()
    })
  })

  describe('with existing exports', () => {
    beforeAll(async () => {
      await fsp.writeFile(
        join(dir, './package.json'),
        JSON.stringify(
          {
            name: 'prepare-ts-with-pkg-json',
            exports: {
              '.': {
                default: './dist/index.js',
              },
            },
          },
          null,
          2,
        ),
      )
    })
    createJob({
      directory: __dirname,
      args: ['prepare', '--cjs'],
    })
    it('should not override existing exports field', async () => {
      assertContainFiles(dir, ['package.json'])
      const pkgJson = JSON.parse(
        await fsp.readFile(join(dir, './package.json'), 'utf-8'),
      )
      expect(pkgJson.files).toContain('dist')
      expect(pkgJson.type).toBeUndefined()
      expect(pkgJson.main).toBe('./dist/cjs/index.js')
      expect(pkgJson.module).toBeUndefined()
      expect(pkgJson.exports).toEqual({
        '.': {
          default: './dist/index.js',
        },
      })
    })
  })
})
