import fs from 'fs'
import os from 'os'
import { join } from 'path'
import Piscina from 'piscina'
import type { BundleConfig } from '../types'
import type { SizeStats } from '../plugins/output-state-plugin'
import type { EntryWorkerTask } from '../worker'

// Below this entry count builds stay in-process: a handful of module graphs
// fits comfortably in one heap, and skipping the pool avoids worker startup.
export const MIN_ENTRIES_FOR_WORKERS = 8

function resolveWorkerFile(): string {
  // Running from source (dev / tests): worker threads inherit execArgv, so
  // the TypeScript register hook loads the .ts worker.
  if (__filename.endsWith('.ts')) {
    return join(__dirname, '..', 'worker.ts')
  }
  // Compiled: this code is bundled into both dist/index.js and
  // dist/bin/cli.js, so the worker sits either next to it or one level up.
  const candidates = [
    join(__dirname, 'worker.js'),
    join(__dirname, '..', 'worker.js'),
  ]
  const workerFile = candidates.find((file) => fs.existsSync(file))
  if (!workerFile) {
    throw new Error('Could not resolve bunchee worker file')
  }
  return workerFile
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
        (os.availableParallelism?.() ?? os.cpus().length) - 1,
      ),
    ),
  })
  try {
    return await Promise.all(
      entryNames.map((entryName) => {
        const task: EntryWorkerTask = { cwd, entryName, options: plainOptions }
        return pool.run(task) as Promise<SizeStats>
      }),
    )
  } finally {
    await pool.destroy()
  }
}
