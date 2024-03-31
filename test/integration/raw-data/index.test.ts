import { existsSync } from 'fs'
import { assertFilesContent, createIntegrationTest } from '../utils'
import { join } from 'path'

describe('integration - raw-data', () => {
  it('should generate proper assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFile = join(distDir, 'index.js')
        expect(existsSync(distFile)).toBe(true)
        await assertFilesContent(distDir, {
          'index.js': '"thisismydata"',
        })
      },
    )
  })
})
