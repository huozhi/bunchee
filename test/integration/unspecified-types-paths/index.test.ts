import fs from 'fs'
import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration tsconfig-override', () => {
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
        const subpathTypes = await import(`${dir}/dist/index.js`)
        expect(fs.existsSync(subpathTypes)).toBe(false)
      },
    )
  })
})
