import fs from 'fs'
import os from 'os'
import { dirname, join } from 'path'
import Piscina from 'piscina'
import type { BundleConfig } from '../types'
import type { SizeStats } from '../plugins/output-state-plugin'
import type { EntryWorkerTask } from '../worker'

// Below this entry count builds stay in-process: a handful of module graphs
// fits comfortably in one heap, and skipping the pool avoids worker startup.
export const MIN_ENTRIES_FOR_WORKERS = 8

// Threads are capped well below the core count on purpose. Every thread is a
// separate isolate, so each one builds its own rollup-plugin-dts instance and
// its own TypeScript program (see the memoization in rollup/input.ts) — the
// single largest allocation in a typical build. Total memory therefore scales
// with thread count, and `availableParallelism()` reflects the CPU affinity
// mask rather than a cgroup CPU quota, so a container on a large host would
// otherwise fan out to dozens of TypeScript programs and OOM the box.
const MAX_WORKER_THREADS = 4

// The handler is loaded from this file by its export name, so no separate
// worker asset needs to exist in dist.
export const WORKER_HANDLER_NAME = 'buildEntryInWorker'

function resolveWorkerFile(): string {
  // This code runs from src/lib/ in dev and is bundled into dist/index.js and
  // dist/bin/cli.js when compiled, so locate the package root first and
  // resolve the worker from there. When running from source, worker threads
  // inherit execArgv, so the TypeScript register hook loads the .ts worker.
  let packageRoot = __dirname
  while (!fs.existsSync(join(packageRoot, 'package.json'))) {
    packageRoot = dirname(packageRoot)
  }
  return join(
    packageRoot,
    __filename.endsWith('.ts') ? 'src/worker.ts' : 'dist/index.js',
  )
}

// Build each entry in its own worker so every entry's module graphs live in
// an isolated V8 heap: peak memory per heap is one entry, not the whole
// package, no matter how many entries there are.
export async function runEntriesInWorkers(
  cwd: string,
  entryNames: string[],
  options: BundleConfig,
): Promise<SizeStats[]> {
  const { _callbacks, onSuccess, ...plainOptions } = options
  const pool = new Piscina({
    filename: resolveWorkerFile(),
    maxThreads: Math.max(
      1,
      Math.min(
        entryNames.length,
        MAX_WORKER_THREADS,
        (os.availableParallelism?.() ?? os.cpus().length) - 1,
      ),
    ),
  })
  try {
    return await Promise.all(
      entryNames.map((entryName) => {
        const task: EntryWorkerTask = { cwd, entryName, options: plainOptions }
        return pool.run(task, {
          name: WORKER_HANDLER_NAME,
        }) as Promise<SizeStats>
      }),
    )
  } finally {
    await pool.destroy()
  }
}
