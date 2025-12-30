import { beforeAll, describe, expect, it } from 'vitest'
import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createJob,
  deleteFile,
  stripANSIColor,
} from '../../testing-utils'

describe('integration prepare-no-src', () => {
  beforeAll(async () => {
    await deleteFile(join(__dirname, './package.json'))
    await deleteFile(join(__dirname, './tsconfig.json'))
    // Remove src folder if it exists
    const srcDir = join(__dirname, './src')
    try {
      await fsp.rm(srcDir, { recursive: true, force: true })
    } catch {
      // Ignore errors if src doesn't exist
    }
  })

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

    // Should have type: 'module' since package.json didn't exist
    expect(pkgJson.type).toBe('module')

    // Should have bunchee in devDependencies
    expect(pkgJson.devDependencies).toEqual({
      bunchee: 'latest',
    })

    // Should have exports configured for index.ts
    expect(pkgJson.exports).toEqual({
      '.': {
        import: {
          types: './dist/es/index.d.ts',
          default: './dist/es/index.js',
        },
        require: {
          types: './dist/cjs/index.d.cts',
          default: './dist/cjs/index.cjs',
        },
      },
    })

    // Should have main, module, and types fields
    expect(pkgJson.main).toBe('./dist/es/index.js')
    expect(pkgJson.module).toBe('./dist/es/index.js')
    expect(pkgJson.types).toBe('./dist/es/index.d.ts')

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
