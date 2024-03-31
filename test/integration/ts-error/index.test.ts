import { join } from 'path'
import { existsSync } from 'fs'
import { createIntegrationTest } from '../utils'

describe('integration ts-error', () => {
  it('should error when ts is not properly resolved', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stderr, distDir }) => {
        const distFile = join(distDir, './index.js')
        expect(existsSync(distFile)).toBe(false)
        expect(stderr).toMatch(/Could not load TypeScript compiler/)
      },
    )
  })
})
