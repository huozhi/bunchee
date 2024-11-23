import { createIntegrationTest, getFileNamesFromDirectory } from '../utils'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await getFileNamesFromDirectory(distDir)
        expect(jsFiles).toEqual([
          'another.cjs',
          'another.js',
          'client.cjs',
          'client.js',
          'index.cjs',
          'index.js',
          'index.react-server.js',
          'lib/_app-context.cjs',
          'lib/_app-context.js',
          'lib/_util.cjs',
          'lib/_util.js',
        ])
      },
    )
  })
})
