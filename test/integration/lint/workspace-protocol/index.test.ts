import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration lint workspace-protocol', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn that workspace: range will publish unrewritten', () => {
    const { stderr } = job
    expect(stderr).toContain('workspace: protocol')
    expect(stderr).toContain('"dependencies.foo"')
  })
})
