import { promises as fsp } from 'fs'
import { join, extname } from 'path'
import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration server-components', () => {
  it('should generate proper assets for each exports', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const distFiles = await fsp.readdir(join(dir, 'dist'))

        const requiredFiles = [
          'dist/index.js',
          'dist/index.cjs',
          'dist/ui.js',
          'dist/ui.cjs',
        ]

        await assertContainFiles(dir, requiredFiles)

        // split chunks
        const indexContent = await fsp.readFile(
          join(dir, 'dist/index.js'),
          'utf-8',
        )
        expect(indexContent).not.toContain('use server')
        expect(indexContent).not.toContain('use client')

        // client component chunks will remain the directive
        const clientClientChunkFiles = distFiles.filter((f) =>
          f.includes('client-client-'),
        )
        clientClientChunkFiles.forEach(async (f) => {
          const content = await fsp.readFile(join(dir, 'dist', f), 'utf-8')
          expect(content).toContain('use client')
        })
        // cjs and esm, check the extension and files amount
        expect(clientClientChunkFiles.map((f) => extname(f)).sort()).toEqual([
          '.cjs',
          '.js',
        ])

        // asset is only being imported to ui, no split
        const assetClientChunkFiles = distFiles.filter((f) =>
          f.includes('_asset-client-'),
        )
        expect(assetClientChunkFiles.length).toBe(0)

        // server component chunks will remain the directive
        const serverChunkFiles = distFiles.filter((f) =>
          f.includes('_actions-server-'),
        )
        serverChunkFiles.forEach(async (f) => {
          const content = await fsp.readFile(join(dir, 'dist', f), 'utf-8')
          expect(content).toContain('use server')
          expect(content).not.toContain('use client')
        })
        // cjs and esm, check the extension and files amount
        expect(serverChunkFiles.map((f) => extname(f)).sort()).toEqual([
          '.cjs',
          '.js',
        ])

        // For single entry ./ui, client is bundled into client
        const uiEsm = await fsp.readFile(join(dir, 'dist/ui.js'), 'utf-8')
        expect(uiEsm).toContain('use client')
        expect(uiEsm).not.toContain('./_client-client')

        // asset is only being imported to ui, no split
        expect(uiEsm).not.toContain('./_asset-client')
      },
    )
  })
})
