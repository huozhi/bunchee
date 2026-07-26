import type { BuildContext, BundleConfig } from './types'
import type { SizeStats } from './plugins/output-state-plugin'
import bundle from './bundle'

export type EntryWorkerTask = {
  cwd: string
  entryName: string
  options: BundleConfig
}

// Piscina task: build a single entry (all of its output formats and types)
// in this worker's own isolate, so its module graphs never share a heap with
// other entries. Returns the size stats for the main thread's output table.
export default async function buildEntryInWorker({
  cwd,
  entryName,
  options,
}: EntryWorkerTask): Promise<SizeStats> {
  let buildContext: BuildContext | undefined
  await bundle('', {
    ...options,
    cwd,
    // The output directory is cleaned once on the main thread before the
    // entries are dispatched; workers run concurrently and must not remove
    // each other's output.
    clean: false,
    _entryFilter: [entryName],
    _callbacks: {
      onBuildStart(context: BuildContext) {
        buildContext = context
      },
    },
  })
  return buildContext?.pluginContext.outputState.getSizeStats() ?? new Map()
}
