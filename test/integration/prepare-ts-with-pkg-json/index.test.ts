import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createIntegrationTest, deleteFile } from '../utils'

describe('integration prepare-ts-with-pkg-json', () => {
  const dir = __dirname
  beforeAll(async () => {
    await fsp.writeFile(
      join(dir, './package.json'),
      '{ "name": "prepare-ts-with-pkg-json" }',
    )
    await deleteFile(join(dir, './tsconfig.json'))
  })
  it('should contain files', async () => {
    await createIntegrationTest(
      {
        args: ['--prepare'],
        directory: __dirname,
      },
      async ({ dir }) => {
        assertContainFiles(dir, ['package.json'])
        const pkgJson = JSON.parse(
          await fsp.readFile(join(dir, './package.json'), 'utf-8'),
        )
        expect(pkgJson.files).toContain('dist')
        expect(pkgJson.type).toBeUndefined()
        expect(pkgJson.main).toBe('./dist/cjs/index.js')
        expect(pkgJson.module).toBe('./dist/es/index.mjs')
      },
    )
  })
})
