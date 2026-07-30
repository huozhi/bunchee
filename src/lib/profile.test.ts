import { describe, expect, it } from 'vitest'
import { createProfileEvent, PROFILE_PREFIX } from './profile'

describe('build profiling', () => {
  it('creates a stable JSON-serializable event', () => {
    const event = createProfileEvent('rollup.graph', 12.34567, {
      kind: 'dts',
      inputs: 57,
      omitted: undefined,
    })

    expect(PROFILE_PREFIX).toBe('BUNCHEE_PROFILE ')
    expect(event).toEqual({
      schemaVersion: 1,
      phase: 'rollup.graph',
      durationMs: 12.346,
      pid: process.pid,
      details: {
        kind: 'dts',
        inputs: 57,
      },
    })
    expect(() => JSON.stringify(event)).not.toThrow()
  })
})
