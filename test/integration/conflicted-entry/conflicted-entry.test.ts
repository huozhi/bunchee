import { describe, expect, it } from 'vitest'
import { createJob } from '../../testing-utils'

describe('integration - conflicted-entry', () => {
  const { job } = createJob({ directory: __dirname })
  it('should error on conflicted entries', async () => {
    const { code, stderr } = job
    expect(code).toBe(1)
    expect(stderr).toContain('Conflicted entry files found for entries: ./foo')
  })
})
