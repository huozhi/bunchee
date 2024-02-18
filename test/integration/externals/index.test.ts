import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../utils'

describe('integration externals', () => {
  it('should handle externals', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFile = `${distDir}/index.js`
        const content = await readFile(distFile, { encoding: 'utf-8' })
        expect(content).toMatch(/['"]peer-dep['"]/)
        expect(content).toMatch(/['"]peer-dep-meta['"]/)
      },
    )
  })
})
