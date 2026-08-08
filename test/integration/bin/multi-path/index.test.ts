import fs from 'fs/promises'
import path from 'path'
import { beforeAll, describe, expect, it } from 'vitest'
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
  beforeAll(async () => {
    // A partially populated dist directory used to make the automatic
    // pre-build lint report outputs that this build was about to generate.
    await fs.mkdir(path.join(__dirname, 'dist'), { recursive: true })
  })

  const { distDir, job } = createJob({
    directory: __dirname,
  })
  it('should work with bin as multi path', async () => {
    expect(job.stderr).not.toContain('Declared output does not exist on disk')
    await assertFilesContent(distDir, {
      'bin/a.js': '#!/usr/bin/env node',
      'bin/b.js': '#!/usr/bin/env node',
    })
  })
})
