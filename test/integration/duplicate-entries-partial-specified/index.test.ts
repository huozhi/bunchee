import {
  createIntegrationTest,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration duplicate-entries-partial-specified', () => {
  it('should not generate js types paths if not specified', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        expect(await getFileNamesFromDirectory(distDir)).toEqual([
          'a.js',
          'a.workerd.js',
        ])
      },
    )
  })
})
