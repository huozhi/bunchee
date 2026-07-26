import { getHeapStatistics } from 'v8'

// At most this many builds run at once. Additionally, when V8 heap usage
// crosses the high-water fraction of the heap limit, new builds wait for
// in-flight ones to finish and release their memory — throttling down to one
// at a time. At least one task is always in flight, so the queue cannot stall.
const MAX_CONCURRENCY = 4
const HEAP_HIGH_WATER = 0.65

export async function runWithMemoryBudget<T>(
  tasks: (() => Promise<T>)[],
): Promise<T[]> {
  const highWater = getHeapStatistics().heap_size_limit * HEAP_HIGH_WATER
  const results: T[] = new Array(tasks.length)
  const inflight = new Set<Promise<void>>()
  let firstError: unknown
  let failed = false

  for (let i = 0; i < tasks.length; i++) {
    while (
      !failed &&
      inflight.size > 0 &&
      (inflight.size >= MAX_CONCURRENCY ||
        process.memoryUsage().heapUsed > highWater)
    ) {
      await Promise.race(inflight)
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
