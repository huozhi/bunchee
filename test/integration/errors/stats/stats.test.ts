import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration - errors/stats', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['--stats'],
  })

  it('should still print the stats JSON when the build fails', () => {
    expect(job.code).toBe(1)
    const stats = JSON.parse(job.stdout)
    expect(stats.status).toBe('error')
    expect(stats.errors).toEqual([
      expect.objectContaining({ file: 'src/index.js' }),
    ])
  })
})
