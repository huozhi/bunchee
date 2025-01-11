import { createIntegrationTest, getFileNamesFromDirectory } from 'testing-utils'

describe('integration shared-module-ts-esm', () => {
  it('should contain correct type file path of shared chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const files = await getFileNamesFromDirectory(distDir)
        expect(files).toEqual([
          '_util.d.ts',
          '_util.js',
          '_util.mjs',
          'cjs/index.d.ts',
          'cjs/index.js',
          'es/index.mjs',
        ])
      },
    )
  })
})
