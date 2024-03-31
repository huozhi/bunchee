import { existsSync } from 'fs'
import { join } from 'path'
import {
  assertContainFiles,
  assertFilesContent,
  createIntegrationTest,
} from '../utils'

describe('integration - ts-incremental-with-buildinfofile', () => {
  it('should generate proper assets', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.js', 'index.d.ts']
        await assertContainFiles(distDir, distFiles)
        await assertFilesContent(distDir, {
          'index.d.ts': 'declare const _default: () => string;',
        })

        expect(existsSync(join(distDir, '.tsbuildinfo'))).toBe(false)
      },
    )
  })
})
