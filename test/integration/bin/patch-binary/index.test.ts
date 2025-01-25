import { describe, it } from 'vitest'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
} from '../../../testing-utils'

describe('integration bin/patch-binary', () => {
  const { distDir } = createJob({ directory: __dirname })
  it('should patch binary directive', async () => {
    const distFiles = ['bin.js']
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'bin.js': "#!/usr/bin/env node\nconsole.log('Hello, world!');",
    })
  })
})
