import {
  assertFilesContent,
  createIntegrationTest,
  getFileNamesFromDirectory,
} from '../utils'

describe('integration - tsconfig-override', () => {
  it('should not generate js types paths if not specified', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        assertFilesContent(dir, {
          './dist/subpath/nested.js': 'subpath/nested',
          './dist/subpath/nested.cjs': 'subpath/nested',
        })
        // No types files should be generated
        expect(await getFileNamesFromDirectory(dir)).toEqual([
          'dist/subpath/nested.cjs',
          'dist/subpath/nested.js',
        ])
      },
    )
  })
})
