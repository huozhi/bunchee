import { describe, expect, it } from 'vitest'
import { assertFilesContent, createJob } from '../../../testing-utils'

describe('integration - lint - bin outputs', () => {
  const { distDir, job } = createJob({
    directory: __dirname,
  })

  it('does not warn about binary outputs before building them', async () => {
    expect(job.stderr).not.toContain('Declared output does not exist on disk')
    await assertFilesContent(distDir, {
      'bin/html2.js': '#!/usr/bin/env node',
    })
  })
})
