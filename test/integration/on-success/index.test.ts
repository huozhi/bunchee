import { describe, expect, it } from 'vitest'
import { createJob } from '../../testing-utils'

describe('integration - on-success', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['--on-success', 'node dist/index.js'],
  })

  it('should work', async () => {
    console.log(job.stdout + job.stderr)
    expect(job.code).toBe(0)
    expect(job.stdout).toContain('Log from --on-success')
  })
})
