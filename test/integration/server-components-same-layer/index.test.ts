import { promises as fsp } from 'fs'
import { join } from 'path'
import { createIntegrationTest } from '../utils'

describe('integration server-components-same-layer', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const distFiles = await fsp.readdir(join(dir, 'dist'))
        const clientChunkFiles = distFiles.filter((f) =>
          f.includes('client-client-'),
        )
        expect(clientChunkFiles.length).toBe(0)

        // index doesn't have "use client" directive
        const indexCjs = await fsp.readFile(
          join(dir, 'dist/index.cjs'),
          'utf-8',
        )
        const indexEsm = await fsp.readFile(join(dir, 'dist/index.js'), 'utf-8')
        expect(indexCjs).toContain('use client')
        expect(indexEsm).toContain('use client')
      },
    )
  })
})
