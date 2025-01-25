import { describe, it } from 'vitest'
import {
  assertFilesContent,
  createJob,
  isWindows,
} from '../../../testing-utils'

describe('integration bin/multi-path', () => {
  // TODO: handle the transform error on windows
  if (isWindows) {
    it('skip test on windows', () => {})
    return
  }
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work with bin as multi path', async () => {
    await assertFilesContent(distDir, {
      'bin/a.js': '#!/usr/bin/env node',
      'bin/b.js': '#!/usr/bin/env node',
    })
  })
})
