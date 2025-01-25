import { describe, it } from 'vitest'
import { assertFilesContent, createJob } from '../../../testing-utils'

describe('integration bin/cts', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work with bin as .cts extension', async () => {
    await assertFilesContent(distDir, {
      'bin/index.cjs': '#!/usr/bin/env node',
    })
  })
})
