import { createIntegrationTest } from '../utils'
import { glob } from 'glob'

describe('integration server-components', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await glob(['**/*.{,c,m}js', '**/*.{,c,m}d.ts'], {
          cwd: distDir,
        })

        expect(jsFiles).toEqual([
          'ui.js',
          'ui.cjs',
          'mod_client-client-DAeHkA4H.cjs',
          'mod_client-client-BO96FYFA.js',
          'mod_actions-server-DSdgX-jM.js',
          'mod_actions-server-B2kXJwqw.cjs',
          'index.js',
          'index.cjs',
        ])
      },
    )
  })
})
