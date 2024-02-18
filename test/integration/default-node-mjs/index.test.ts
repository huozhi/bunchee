import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../utils'

describe('integration', () => {
  test(`default-node-mjs`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        args: ['-o', 'dist/index.node.mjs'],
      },
      async ({ distFile }) => {
        expect(await readFile(distFile, 'utf-8')).toContain(
          'export {'
        )
        expect(await readFile(distFile, 'utf-8')).not.toContain(
          'exports'
        )
      },
    )
  })
})
