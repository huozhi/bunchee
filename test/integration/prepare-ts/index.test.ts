import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createJob,
  stripANSIColor,
} from '../../testing-utils'

describe('integration prepare-ts', () => {
  beforeAll(async () => {
    await fsp.writeFile(
      join(__dirname, './package.json'),
      '{ "type": "commonjs" }',
    )
  })

  const { dir, job } = createJob({
    directory: __dirname,
    args: ['prepare'],
  })

  it('should set type to module and use correct exports pattern with types', async () => {
    const { stdout } = job
    await assertContainFiles(dir, ['package.json', 'tsconfig.json'])
    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )
    // Verify type is set to module (ESM-first default)
    expect(pkgJson.type).toBe('module')
    // With type: module and TypeScript, ESM uses .js, types use .d.ts
    expect(pkgJson.main).toBe('./dist/index.js')
    expect(pkgJson.module).toBeUndefined()
    expect(pkgJson.types).toBe('./dist/index.d.ts')
    expect(pkgJson.files).toContain('dist')
    expect(pkgJson.bin).toBe('./dist/bin/index.js')
    expect(pkgJson.exports).toEqual({
      './foo': {
        types: './dist/foo.d.ts',
        default: './dist/foo.js',
      },
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    })

    // Verify build scripts are added by default
    expect(pkgJson.scripts).toEqual({
      build: 'bunchee',
      prepublishOnly: 'npm run build',
    })

    expect(stripANSIColor(stdout)).toMatchInlineSnapshot(`
      "Detected using TypeScript but tsconfig.json is missing, created a tsconfig.json for you.
      Discovered binaries entries:
        ./$binary: bin.ts
      Discovered exports entries:
        ./foo: foo.ts
        .    : index.ts
      ✓ Configured \`exports\` in package.json
      "
    `)
  })
})
