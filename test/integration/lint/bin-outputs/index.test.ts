import { describe, expect, it } from 'vitest'
import { assertFilesContent, createJob } from '../../../testing-utils'

describe('integration - lint - bin outputs', () => {
  const { distDir, job } = createJob({
    directory: __dirname,
  })

  it('checks outputs after building binaries', async () => {
    expect(job.stderr).toContain(
      'Declared output does not exist on disk: dist/missing.js',
    )
    expect(job.stderr).not.toContain(
      'Declared output does not exist on disk: dist/bin/html2.js',
    )
    await assertFilesContent(distDir, {
      'bin/html2.js': '#!/usr/bin/env node',
    })
  })
})
