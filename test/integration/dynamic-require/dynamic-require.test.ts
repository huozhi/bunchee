import fs from 'fs'
import {
  createIntegrationTest,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration - dynamic-require', () => {
  it('should work', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        expect(await getFileNamesFromDirectory(distDir)).toEqual([
          'foo.cjs',
          'foo.js',
          'index.cjs',
          'index.js',
        ])
        // TODO: add helper of read content of dist file

        // For require calls to the relative path, the value should be bundled
        expect(fs.readFileSync(`${distDir}/index.cjs`, 'utf-8')).toContain(
          `return 'being-required'`,
        )
        expect(fs.readFileSync(`${distDir}/index.js`, 'utf-8')).toContain(
          `return 'being-required'`,
        )
        // For require calls to the external library, the value should not be bundled
        expect(fs.readFileSync(`${distDir}/foo.cjs`, 'utf-8')).not.toContain(
          `external-lib-value`,
        )
        expect(fs.readFileSync(`${distDir}/foo.js`, 'utf-8')).not.toContain(
          `external-lib-value`,
        )
      },
    )
  })
})
