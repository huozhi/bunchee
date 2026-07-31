import { describe, expect, it } from 'vitest'
import { createJob } from '../../../testing-utils'

describe('integration lint condition-order', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['lint'],
  })

  it('should warn that types should come first and default last', () => {
    const { code, stderr } = job
    expect(code).toBe(1)
    expect(stderr).toContain('"types" condition should come first')
    expect(stderr).toContain('"default" condition should come last')
    expect(stderr).toContain('condition "import"')
  })
})
