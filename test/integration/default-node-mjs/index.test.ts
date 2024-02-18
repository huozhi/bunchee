import { readFile } from 'fs/promises'
import { createIntegrationTest, existsFile } from '../utils'

describe('integration', () => {
  test(`default-node-mjs`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = [`${distDir}/index.node.mjs`]

        for (const f of distFiles) {
          expect(await existsFile(f)).toBe(true)
        }

        expect(await readFile(distFiles[0], 'utf-8')).toContain('export {')
        expect(await readFile(distFiles[0], 'utf-8')).not.toContain('exports')
      },
    )
  })
})
