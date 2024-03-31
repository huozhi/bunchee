import { promises as fsp } from 'fs'
import { join } from 'path'
import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration shared-entry', () => {
  it('should split shared module into one chunk layer', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const distFiles = [
          './dist/index.js',
          './dist/index.mjs',
          './dist/shared.js',
          './dist/shared.mjs',
        ]
        assertContainFiles(dir, distFiles)

        // ESM bundle imports from <pkg/export>
        const indexEsm = await fsp.readFile(
          join(dir, './dist/index.mjs'),
          'utf-8',
        )
        expect(indexEsm).toContain('shared-entry/shared')
        expect(indexEsm).toContain('index-export')
        expect(indexEsm).not.toMatch(/['"]\.\/shared['"]/)
        expect(indexEsm).not.toContain('shared-export')

        // CJS bundle imports from <pkg/export>
        const indexCjs = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(indexCjs).toContain('shared-entry/shared')
        expect(indexCjs).toContain('index-export')
        expect(indexCjs).not.toMatch(/['"]\.\/shared['"]/)

        // shared entry contains its own content
        const sharedEsm = await fsp.readFile(
          join(dir, './dist/shared.mjs'),
          'utf-8',
        )
        expect(sharedEsm).toContain('shared-export')

        // shared entry contains its own content
        const sharedCjs = await fsp.readFile(
          join(dir, './dist/shared.js'),
          'utf-8',
        )
        expect(sharedCjs).toContain('shared-export')
      },
    )
  })
})
