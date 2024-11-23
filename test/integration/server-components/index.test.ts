import { createIntegrationTest, getFileNamesFromDirectory } from '../utils'

describe('integration server-components', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await getFileNamesFromDirectory(distDir)

        expect(jsFiles).toEqual([
          'index.cjs',
          'index.js',
          'mod_actions-server-B2kXJwqw.cjs',
          'mod_actions-server-DSdgX-jM.js',
          'mod_client-client-BO96FYFA.js',
          'mod_client-client-DAeHkA4H.cjs',
          'ui.cjs',
          'ui.js',
        ])
      },
    )
  })
})
