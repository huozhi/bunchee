import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../utils'

describe('integration import fallback', () => {
  it('should handle import fallback', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const aEdgeLightFile = `${distDir}/a.edge-light.js`
        const content = await readFile(aEdgeLightFile, { encoding: 'utf-8' })
        expect(content).toMatch(/import '.\/b.js'/)
      },
    )
  })
})
