import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './concurrency'

function createTracker() {
  let running = 0
  let peak = 0
  return {
    get peak() {
      return peak
    },
    task<T>(value: T, delay = 0): () => Promise<T> {
      return async () => {
        running++
        peak = Math.max(peak, running)
        await new Promise((resolve) => setTimeout(resolve, delay))
        running--
        return value
      }
    },
  }
}

describe('runWithConcurrency', () => {
  it('should resolve the results in the input order', async () => {
    const tracker = createTracker()
    const tasks = [
      tracker.task('a', 30),
      tracker.task('b', 10),
      tracker.task('c', 20),
      tracker.task('d', 0),
    ]
    expect(await runWithConcurrency(tasks, 2)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('should never run more tasks than the limit at once', async () => {
    const tracker = createTracker()
    const tasks = Array.from({ length: 10 }, (_, i) => tracker.task(i, 5))
    const results = await runWithConcurrency(tasks, 3)
    expect(results).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    expect(tracker.peak).toBe(3)
  })

  it('should run everything at once when the limit is not finite', async () => {
    const tracker = createTracker()
    const tasks = Array.from({ length: 5 }, (_, i) => tracker.task(i, 5))
    expect(await runWithConcurrency(tasks, Infinity)).toEqual([0, 1, 2, 3, 4])
    expect(tracker.peak).toBe(5)
  })

  it('should run everything at once when the limit is zero or negative', async () => {
    const zero = createTracker()
    await runWithConcurrency(
      Array.from({ length: 4 }, (_, i) => zero.task(i, 5)),
      0,
    )
    expect(zero.peak).toBe(4)

    const negative = createTracker()
    await runWithConcurrency(
      Array.from({ length: 4 }, (_, i) => negative.task(i, 5)),
      -1,
    )
    expect(negative.peak).toBe(4)
  })

  it('should handle an empty task list', async () => {
    expect(await runWithConcurrency([], 4)).toEqual([])
  })

  it('should reject when a task rejects', async () => {
    const tasks = [
      async () => 'ok',
      async () => {
        throw new Error('boom')
      },
    ]
    await expect(runWithConcurrency(tasks, 2)).rejects.toThrow('boom')
  })
})
