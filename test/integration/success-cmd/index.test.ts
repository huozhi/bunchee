import { describe, expect, it } from 'vitest'
import { createJob } from '../../testing-utils'

describe('integration - success arg', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['--success', 'node dist/index.js'],
  })

  it('should work', async () => {
    console.log(job.stdout + job.stderr)
    expect(job.code).toBe(0)
    expect(job.stdout).toContain('Log from --success')
  })
})
