import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createIntegrationTest,
  stripANSIColor,
} from '../utils'

describe('integration prepare-js', () => {
  const dir = __dirname
  beforeAll(async () => {
    await fsp.writeFile(join(dir, './package.json'), '{ "type": "commonjs" }')
  })

  it('should contain correct files', async () => {
    await createIntegrationTest(
      {
        args: ['--prepare'],
        directory: __dirname,
      },
      async ({ dir, stdout }) => {
        await assertContainFiles(dir, ['package.json'])
        const pkgJson = JSON.parse(
          await fsp.readFile(join(dir, './package.json'), 'utf-8'),
        )
        expect(pkgJson.main).toBe('./dist/index.js')
        expect(pkgJson.module).toBe('./dist/index.mjs')
        expect(pkgJson.types).toBeFalsy()
        expect(pkgJson.files).toContain('dist')
        expect(pkgJson.bin).toBe('./dist/bin/index.js')
        expect(pkgJson.exports).toEqual({
          './foo': {
            import: './dist/foo.mjs',
            require: './dist/foo.js',
          },
          '.': {
            import: './dist/index.mjs',
            require: './dist/index.js',
          },
        })

        /*
          Discovered binaries entries:
            .: bin.js
          Discovered exports entries:
            ./foo: foo.js
            .    : index.js
          ✓ Configured `exports` in package.json
        */
        expect(stdout).toContain('Discovered binaries entries:')
        expect(stdout).toMatch(/.\s*: bin.js/)
        expect(stdout).toContain('Discovered exports entries:')
        expect(stdout).toMatch(/\.\/foo\s*: foo.js/)
        expect(stdout).toMatch(/\.\s*: index.js/)
        expect(stripANSIColor(stdout)).toContain(
          '✓ Configured `exports` in package.json',
        )
      },
    )
  })
})
