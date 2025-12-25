import { describe, expect, it } from 'vitest'
import {
  createJob,
  assertContainFiles,
  stripANSIColor,
} from '../../testing-utils'

describe('integration swc-helpers-warning', () => {
  const { job, distDir } = createJob({
    directory: __dirname,
    args: ['--external', '@swc/helpers'],
  })

  it('should warn when output references @swc/helpers but it is not declared', async () => {
    const stderr = stripANSIColor(job.stderr)
    expect(stderr).toContain('Your build output imports "@swc/helpers"')
    expect(stderr).toContain('pnpm add @swc/helpers')

    assertContainFiles(distDir, ['index.js'])
  })
})
