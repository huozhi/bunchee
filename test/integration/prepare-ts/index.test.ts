import fsp from 'fs/promises'
import { join } from 'path'
import {
  assertContainFiles,
  createIntegrationTest,
  deleteFile,
  stripANSIColor,
} from '../utils'

describe('integration prepare-ts', () => {
  beforeAll(async () => {
    await deleteFile(join(__dirname, './package.json'))
    await deleteFile(join(__dirname, './tsconfig.json'))
  })

  it('should contain files', async () => {
    await createIntegrationTest(
      {
        args: ['--prepare'],
        directory: __dirname,
      },
      async ({ dir, stdout }) => {
        await assertContainFiles(dir, ['package.json', 'tsconfig.json'])
        const pkgJson = JSON.parse(
          await fsp.readFile(join(dir, './package.json'), 'utf-8'),
        )
        expect(pkgJson.files).toContain('dist')
        expect(pkgJson.bin).toEqual({
          cli: './dist/bin/cli.js',
          cmd: './dist/bin/cmd.js',
        })
        expect(pkgJson.type).toBe('module')
        expect(pkgJson.main).toBe('./dist/es/index.js')
        expect(pkgJson.module).toBe('./dist/es/index.js')
        expect(pkgJson.exports).toEqual({
          './foo': {
            import: {
              types: './dist/es/foo.d.ts',
              default: './dist/es/foo.js',
            },
            require: {
              types: './dist/cjs/foo.d.cts',
              default: './dist/cjs/foo.cjs',
            },
          },
          '.': {
            'react-server': './dist/es/index-react-server.mjs',
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

        /*
          Discovered binaries entries:
            ./cli: cli.ts
            ./cmd: cmd.ts
          Discovered exports entries:
            ./foo: foo.ts
            .    : index.react-server.ts
            .    : index.ts
          ✓ Configured `exports` in package.json
        */
        expect(stripANSIColor(stdout)).toContain(
          'Detected using TypeScript but tsconfig.json is missing, created a tsconfig.json for you.',
        )
        expect(stdout).toContain('Discovered binaries entries:')
        expect(stdout).toMatch(/\.\s*: index.ts/)
        expect(stdout).toContain('Discovered exports entries:')
        expect(stdout).toMatch(/\.\/foo\s*: foo.ts/)
        expect(stdout).toMatch(/\.\s*: index.react-server.ts/)
        expect(stripANSIColor(stdout)).toContain(
          '✓ Configured `exports` in package.json',
        )
      },
    )
  })
})
