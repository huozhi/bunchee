import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createJob,
  stripANSIColor,
} from '../../testing-utils'

describe('integration prepare-js-esm', () => {
  beforeAll(async () => {
    await fsp.writeFile(
      join(__dirname, './package.json'),
      '{ "type": "commonjs" }',
    )
  })

  const { dir, job } = createJob({
    directory: __dirname,
    args: ['prepare', '--esm'],
  })

  it('should set type to module and use correct extensions', async () => {
    const { stdout } = job
    await assertContainFiles(dir, ['package.json'])
    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )
    // Verify type is set to module
    expect(pkgJson.type).toBe('module')
    // With type: module, ESM uses .js, CJS uses .cjs
    expect(pkgJson.main).toBe('./dist/index.js')
    expect(pkgJson.module).toBeUndefined()
    expect(pkgJson.types).toBeFalsy()
    expect(pkgJson.files).toContain('dist')
    expect(pkgJson.bin).toBe('./dist/bin/index.js')
    expect(pkgJson.exports).toEqual({
      './foo': './dist/foo.js',
      '.': './dist/index.js',
    })

    // Verify additional setup for --esm
    expect(pkgJson.scripts).toEqual({
      build: 'bunchee',
      prepublishOnly: 'npm run build',
    })

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
