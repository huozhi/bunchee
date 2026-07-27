import fs from 'fs'
import os from 'os'
import { dirname, extname, join } from 'path'
import Piscina from 'piscina'
import type { BundleConfig } from '../types'
import type { SizeStats } from '../plugins/output-state-plugin'
import type { ErrorDetails, EntryWorkerTask } from '../worker'
import { logger, pauseActiveSpinner } from '../logger'

// Below this entry count builds stay in-process: a handful of module graphs
// fits comfortably in one heap, and skipping the pool avoids worker startup.
export const MIN_ENTRIES_FOR_WORKERS = 8

export function availableCores(): number {
  return Math.max(1, (os.availableParallelism?.() ?? os.cpus().length) - 1)
}

// The handler is loaded from a file by its export name, so no separate worker
// asset needs to exist in dist.
export const WORKER_HANDLER_NAME = 'buildEntryInWorker'

function resolveWorkerFile(): string {
  // Running from source, the handler is a sibling module. Bundled, this code
  // is only ever reachable through the package's main entry — the bin requires
  // that entry rather than inlining it — and the same bundle re-exports the
  // handler, so the file to hand piscina is the one this code is running from.
  const sibling = join(dirname(__dirname), `worker${extname(__filename)}`)
  return fs.existsSync(sibling) ? sibling : __filename
}

function restoreErrorDetails(error: any): unknown {
  const details: ErrorDetails | undefined = error?.cause
  if (!details?.props) {
    // Not one of ours: a worker that exited, or a task failed by pool.destroy.
    return error
  }
  delete error.cause
  error.name = details.name
  return Object.assign(error, details.props)
}

// Build entries in a pool of worker threads so a single entry's module graphs
// never share a heap with the rest of the package. Threads are reused across
// entries, so a heap can hold more than one entry's garbage over time — what
// it never holds is all of them at once.
export async function runEntriesInWorkers(
  cwd: string,
  cliEntryPath: string,
  /**
   * One group per worker task. Usually one entry each, but the merged path
   * hands each worker a shard of entries to build together.
   */
  entryGroups: string[][],
  options: BundleConfig,
): Promise<SizeStats[]> {
  // `_callbacks` holds functions, which structured clone cannot move.
  const { _callbacks, ...plainOptions } = options
  const pool = new Piscina({
    filename: resolveWorkerFile(),
    maxThreads: Math.max(1, Math.min(entryGroups.length, availableCores())),
  })
  const resumeSpinner = pauseActiveSpinner()
  if (process.env.DEBUG) {
    const entryCount = entryGroups.reduce((n, group) => n + group.length, 0)
    const shape =
      entryGroups.length === entryCount
        ? ''
        : ` (${entryGroups.length} shards of ~${entryGroups[0].length})`
    logger.log(
      `Building ${entryCount} entries in ${pool.maxThreads} worker threads${shape}`,
    )
  }

  try {
    return await Promise.all(
      entryGroups.map((entryNames) => {
        const task: EntryWorkerTask = {
          cwd,
          cliEntryPath,
          entryNames,
          options: plainOptions,
        }
        return pool.run(task, {
          name: WORKER_HANDLER_NAME,
        }) as Promise<SizeStats>
      }),
    )
  } catch (error) {
    // The first entry to fail rejects here, and destroying the pool below
    // fails whatever is still queued — the rest of the package is not built
    // just to be thrown away.
    throw restoreErrorDetails(error)
  } finally {
    await pool.destroy()
    resumeSpinner()
  }
}
