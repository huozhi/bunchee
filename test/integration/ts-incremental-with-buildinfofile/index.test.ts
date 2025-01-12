import { existsSync } from 'fs'
import { join } from 'path'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
} from '../../testing-utils'

describe('integration - ts-incremental-with-buildinfofile', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should generate proper assets', async () => {
    const distFiles = ['index.js', 'index.d.ts']
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.d.ts': 'declare const _default: () => string;',
    })

    expect(existsSync(join(distDir, '.tsbuildinfo'))).toBe(false)
  })
})
