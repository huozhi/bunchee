import { describe, it } from 'vitest'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
} from '../../testing-utils'

describe('integration ts-no-emit', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should succeed the build', async () => {
    // should still emit declaration files
    const distFiles = ['index.js', 'index.d.ts']

    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.d.ts': 'declare const _default: () => string;',
    })
  })
})
