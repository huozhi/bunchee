import fsp from 'fs/promises'
import { join } from 'path'
import { assertContainFiles, createIntegrationTest, deleteFile } from '../utils'

describe('integration prepare-ts-with-test-file', () => {
  const dir = __dirname
  beforeAll(async () => {
    await deleteFile(join(dir, './package.json'))
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
        expect(pkgJson.main).toBe('./dist/es/index.js')
        expect(pkgJson.module).toBe('./dist/es/index.js')
        expect(Object.keys(pkgJson.exports)).toEqual(['.'])
        expect(Object.keys(pkgJson.exports['.'])).not.toContain('./test')
      },
    )
  })
})
