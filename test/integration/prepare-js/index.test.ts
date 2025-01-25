import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createJob,
  stripANSIColor,
} from '../../testing-utils'

describe('integration prepare-js', () => {
  beforeAll(async () => {
    await fsp.writeFile(
      join(__dirname, './package.json'),
      '{ "type": "commonjs" }',
    )
  })

  const { dir, job } = createJob({ directory: __dirname, args: ['prepare'] })

  it('should contain correct files', async () => {
    const { stdout } = job
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

    expect(stripANSIColor(stdout)).toMatchInlineSnapshot(`
      "Discovered binaries entries:
        ./$binary: bin.js
      Discovered exports entries:
        ./foo: foo.js
        .    : index.js
      ✓ Configured \`exports\` in package.json
      "
    `)
  })
})
