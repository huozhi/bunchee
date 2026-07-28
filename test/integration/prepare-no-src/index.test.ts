import { describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createJob,
  stripANSIColor,
} from '../../testing-utils'

describe('integration prepare-no-src', () => {
  const { dir, job } = createJob({
    args: ['prepare'],
    directory: __dirname,
  })

  it('should create src/index.ts and initialize package.json', async () => {
    const { stdout } = job
    await assertContainFiles(dir, [
      'package.json',
      'src/index.ts',
      'tsconfig.json',
    ])

    // Verify src/index.ts was created
    const indexContent = await fsp.readFile(
      join(dir, './src/index.ts'),
      'utf-8',
    )
    expect(indexContent).toMatchInlineSnapshot(`
      "export function index() {
        return 'index'
      }
      "
    `)

    const pkgJson = JSON.parse(
      await fsp.readFile(join(dir, './package.json'), 'utf-8'),
    )

    // Should have files field with dist
    expect(pkgJson.files).toEqual(['dist'])

    // Should have type: 'module' (ESM-first default)
    expect(pkgJson.type).toBe('module')

    // Should have bunchee in devDependencies
    expect(pkgJson.devDependencies).toEqual({
      bunchee: 'latest',
    })

    // Should have ESM-only exports configured for index.ts
    expect(pkgJson.exports).toEqual({
      '.': {
        types: './dist/index.d.ts',
        default: './dist/index.js',
      },
    })

    // Should have main and types fields (no module in ESM-first)
    expect(pkgJson.main).toBe('./dist/index.js')
    expect(pkgJson.types).toBe('./dist/index.d.ts')
    expect(pkgJson.module).toBeUndefined()

    // Should not have bin
    expect(pkgJson.bin).toBeUndefined()

    // Should show discovered exports in stdout
    expect(stripANSIColor(stdout)).toContain('Discovered exports entries:')
    expect(stripANSIColor(stdout)).toContain('index.ts')
    expect(stripANSIColor(stdout)).toContain(
      'Configured `exports` in package.json',
    )
  })
})
