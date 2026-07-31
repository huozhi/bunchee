import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration lint valid package', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('exits successfully', () => {
    expect(job.code).toBe(0)
    expect(job.stderr).not.toContain('issues found')
  })
})
