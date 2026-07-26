import { describe, expect, it } from 'vitest'
import { runWithMemoryBudget } from './concurrency'

function trackedTask<T>(
  state: { running: number; peak: number },
  value: T,
  delay = 0,
) {
  return async () => {
    state.running++
    state.peak = Math.max(state.peak, state.running)
    await new Promise((resolve) => setTimeout(resolve, delay))
    state.running--
    return value
  }
}

describe('runWithMemoryBudget', () => {
  it('should resolve results in input order regardless of completion order', async () => {
    const state = { running: 0, peak: 0 }
    const tasks = [
      trackedTask(state, 'a', 30),
      trackedTask(state, 'b', 0),
      trackedTask(state, 'c', 15),
      trackedTask(state, 'd', 5),
    ]
    expect(await runWithMemoryBudget(tasks)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('should run more than one task concurrently when memory allows', async () => {
    const state = { running: 0, peak: 0 }
    const tasks = Array.from({ length: 8 }, (_, i) => trackedTask(state, i, 10))
    expect(await runWithMemoryBudget(tasks)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(state.peak).toBeGreaterThan(1)
  })

  it('should never run more than the concurrency cap at once', async () => {
    const state = { running: 0, peak: 0 }
    const tasks = Array.from({ length: 24 }, (_, i) => trackedTask(state, i, 5))
    await runWithMemoryBudget(tasks)
    expect(state.peak).toBeLessThanOrEqual(4)
  })

  it('should handle an empty task list', async () => {
    expect(await runWithMemoryBudget([])).toEqual([])
  })

  it('should reject with the first error and stop starting new tasks', async () => {
    let started = 0
    const tasks = Array.from({ length: 50 }, (_, i) => async () => {
      started++
      if (i === 0) {
        throw new Error('boom')
      }
      await new Promise((resolve) => setTimeout(resolve, 5))
      return i
    })
    await expect(runWithMemoryBudget(tasks)).rejects.toThrow('boom')
    expect(started).toBeLessThan(50)
  })
})
