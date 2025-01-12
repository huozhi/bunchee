import { promises as fsp } from 'fs'
import { join } from 'path'
import { createJob } from '../../testing-utils'

describe('integration server-components-same-layer', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for each exports', async () => {
    const distFiles = await fsp.readdir(distDir)
    const clientChunkFiles = distFiles.filter((f) =>
      f.includes('client-client-'),
    )
    expect(clientChunkFiles.length).toBe(0)

    // index doesn't have "use client" directive
    const indexCjs = await fsp.readFile(join(distDir, 'index.cjs'), 'utf-8')
    const indexEsm = await fsp.readFile(join(distDir, 'index.js'), 'utf-8')
    expect(indexCjs).toContain('use client')
    expect(indexEsm).toContain('use client')
  })
})
