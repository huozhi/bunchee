import { createIntegrationTest } from '../utils'
import { glob } from 'glob'

describe('integration shared-module-ts', () => {
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
          'index.react-server.js',
          'index.js',
          'index.d.ts',
          'index.cjs',
          'another.js',
          'another.d.ts',
          'another.cjs',
          'lib/_util.js',
          'lib/_util.cjs',
          'lib/_app-context.js',
          'lib/_app-context.cjs',
        ])
      },
    )
  })
})
