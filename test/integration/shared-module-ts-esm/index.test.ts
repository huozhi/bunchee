import { glob } from 'glob'
import { createIntegrationTest } from '../utils'

describe('integration shared-module-ts-esm', () => {
  it('should contain correct type file path of shared chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await glob(['**/*.{,c,m}js', '**/*.{,c,m}d.ts'], {
          cwd: distDir,
        })
        expect(jsFiles).toEqual([
          '_util.mjs',
          '_util.js',
          'es/index.mjs',
          'cjs/index.js',
          'cjs/index.d.ts',
        ])
      },
    )
  })
})
