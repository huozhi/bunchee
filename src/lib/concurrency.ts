/**
 * Run async tasks with a concurrency limit to prevent memory overflow.
 * Useful for limiting parallel rollup builds, especially DTS generation.
 */
export async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  if (limit <= 0 || !Number.isFinite(limit)) {
    limit = Infinity
  }

  const results: T[] = new Array(tasks.length)
  let currentIndex = 0

  async function runNext(): Promise<void> {
    while (currentIndex < tasks.length) {
      const index = currentIndex++
      results[index] = await tasks[index]()
    }
  }

  // Start up to `limit` workers
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    runNext(),
  )

  await Promise.all(workers)
  return results
}
