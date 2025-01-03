import { createIntegrationTest, getFileNamesFromDirectory } from '../utils'

describe('integration shared-module-ts', () => {
  it('should contain correct type file path of shared chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const jsFiles = await getFileNamesFromDirectory(distDir)
        expect(jsFiles).toEqual([
          'another.cjs',
          'another.d.ts',
          'another.js',
          'index.cjs',
          'index.d.ts',
          'index.js',
          'index.react-server.js',
          'lib/_app-context.cjs',
          'lib/_app-context.d.ts',
          'lib/_app-context.js',
          'lib/_util.cjs',
          'lib/_util.d.ts',
          'lib/_util.js',
        ])
      },
    )
  })
})
