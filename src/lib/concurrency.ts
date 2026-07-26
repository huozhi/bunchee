import { getHeapStatistics } from 'v8'
import os from 'os'

// Heap-usage fractions steering the concurrency window: shrink the window
// above the high-water mark, grow it below the low-water mark.
const HEAP_HIGH_WATER = 0.65
const HEAP_LOW_WATER = 0.45

// A task's memory materializes only after it has been admitted, so the first
// burst must be conservative: admitting tasks while the heap is still empty
// says nothing about whether they will fit.
const INITIAL_WINDOW = 4

const maxConcurrency = () =>
  Math.max(os.availableParallelism?.() ?? os.cpus().length, INITIAL_WINDOW)

/**
 * Run tasks concurrently with an adaptive window, sized by memory pressure
 * instead of a fixed limit.
 *
 * The window starts small, grows towards CPU parallelism while completed
 * tasks confirm heap headroom, and shrinks when heap usage crosses the
 * high-water mark. Small builds ramp to full parallelism within a few tasks;
 * builds whose module graphs are large enough to threaten the heap limit are
 * throttled down, as far as fully sequential. At least one task is always in
 * flight, so the queue can never stall.
 */
export async function runWithMemoryBudget<T>(
  tasks: (() => Promise<T>)[],
): Promise<T[]> {
  const heapLimit = getHeapStatistics().heap_size_limit
  const highWater = heapLimit * HEAP_HIGH_WATER
  const lowWater = heapLimit * HEAP_LOW_WATER
  const limit = maxConcurrency()
  const results: T[] = new Array(tasks.length)
  const inflight = new Set<Promise<void>>()
  let window = Math.min(INITIAL_WINDOW, limit)
  let firstError: unknown
  let failed = false

  for (let i = 0; i < tasks.length; i++) {
    while (
      !failed &&
      inflight.size > 0 &&
      (inflight.size >= window || process.memoryUsage().heapUsed > highWater)
    ) {
      await Promise.race(inflight)
      const used = process.memoryUsage().heapUsed
      if (used > highWater) {
        window = Math.max(1, window - 1)
      } else if (used < lowWater) {
        window = Math.min(limit, window + 1)
      }
    }
    if (failed) break

    const tracked: Promise<void> = tasks[i]()
      .then(
        (result) => {
          results[i] = result
        },
        (error) => {
          if (!failed) {
            failed = true
            firstError = error
          }
        },
      )
      .finally(() => {
        inflight.delete(tracked)
      })
    inflight.add(tracked)
  }

  await Promise.all(inflight)
  if (failed) {
    throw firstError
  }
  return results
}
