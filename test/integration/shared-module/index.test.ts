import {
  assertFilesContent,
  createIntegrationTest,
  getFileNamesFromDirectory,
} from 'testing-utils'

describe('integration shared-module', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout }) => {
        const jsFiles = await getFileNamesFromDirectory(distDir)
        expect(jsFiles).toEqual([
          '_internal/index.cjs',
          '_internal/index.js',
          '_internal/index.react-server.cjs',
          '_internal/index.react-server.js',
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

        // In index.react-server.js, it should refers to _internal/index.react-server.js
        await assertFilesContent(distDir, {
          'index.react-server.js': `'./_internal/index.react-server.js'`,
          './_internal/index.react-server.js': 'internal:react-server',
        })

        // Hide private shared module
        expect(stdout).not.toContain('./lib/_util')
      },
    )
  })
})
