import * as fsp from 'fs/promises'
import { join } from 'path'
import { createIntegrationTest } from '../utils'

describe('integration tsconfig-override', () => {
  beforeAll(async () => {
    await fsp.writeFile(
      join(__dirname, './package.json'),
      JSON.stringify({
        name: 'tsconfig-override',
        type: 'module',
        exports: {
          '.': {
            default: './dist/index.js',
            types: './dist/index.d.ts',
          },
        },
      }),
    )
    await fsp.writeFile(
      join(__dirname, './tsconfig.json'),
      JSON.stringify({ compilerOptions: { target: 'esnext' } }),
    )
    await fsp.writeFile(
      join(__dirname, './tsconfig.build.json'),
      JSON.stringify({ compilerOptions: { target: 'es5' } }),
    )
  })

  it('should use esnext output in build without override', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const content = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(content).toContain("var index = (()=>'index');")
      },
    )
  })
  it('should use es5 output in build', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        args: ['--tsconfig', 'tsconfig.build.json'],
      },
      async ({ dir }) => {
        const content = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(content).toContain('export { index as default };')
      },
    )
  })
})
