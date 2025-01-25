import { describe, it } from 'vitest'
import {
  createJob,
  assertContainFiles,
  assertFilesContent,
  isWindows,
} from '../../../testing-utils'

describe('integration bin/single-path', () => {
  // TODO: handle the transform error on windows
  if (isWindows) {
    it('skip test on windows', () => {})
    return
  }
  const { distDir } = createJob({ directory: __dirname })
  it('should work with bin as single path', async () => {
    const distFiles = ['bin.js']
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'bin.js': /console.log\('Hello, world!'\)/,
    })
  })
})
