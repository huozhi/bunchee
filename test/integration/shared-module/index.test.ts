import { createIntegrationTest } from '../utils'
import { glob } from 'glob'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await glob('**/*.{,c,m}js', { cwd: distDir })
        expect(jsFiles).toEqual([
          'index.react-server.js',
          'index.js',
          'index.cjs',
          'another.js',
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
