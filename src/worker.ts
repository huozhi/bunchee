import type { BuildContext, BundleConfig } from './types'
import type { SizeStats } from './plugins/output-state-plugin'
import bundle from './bundle'

export type EntryWorkerTask = {
  cwd: string
  cliEntryPath: string
  /** The entries this worker owns; more than one when the caller sharded. */
  entryNames: string[]
  options: BundleConfig
}

// Everything crossing a thread boundary goes through structured clone, and for
// an Error that keeps the message, the stack and the cause — dropping the name
// along with the frame/loc/id/plugin/code that make a rollup error readable.
// The cause does survive, so the rest travels in there and is put back on the
// main thread.
export type ErrorDetails = {
  name: string
  props: Record<string, unknown>
}

function isCloneable(value: unknown): boolean {
  try {
    structuredClone(value)
    return true
  } catch {
    // A plugin is free to hang a function or a class instance off its error.
    return false
  }
}

function toTransferableError(error: any): Error {
  const props: Record<string, unknown> = {}
  const keys = error && typeof error === 'object' ? Object.keys(error) : []
  for (const key of keys) {
    if (isCloneable(error[key])) {
      props[key] = error[key]
    }
  }
  const details: ErrorDetails = { name: error?.name ?? 'Error', props }
  const transferable = new Error(error?.message ?? String(error))
  // Assigned rather than passed to the constructor: the project targets ES2019
  // and structured clone picks up an own `cause` property either way.
  ;(transferable as Error & { cause?: ErrorDetails }).cause = details
  transferable.stack = error?.stack
  return transferable
}

// Piscina task: build a single entry (all of its output formats and types) in
// this worker's own isolate, so its module graphs never share a heap with the
// entries handed to other threads. Returns the size stats for the main
// thread's output table.
// Loaded by name from src/worker.ts in dev and from the package's main bundle
// when compiled — a named export is what makes the single handler work for
// both.
/** @internal */
export async function buildEntryInWorker({
  cwd,
  cliEntryPath,
  entryNames,
  options,
}: EntryWorkerTask): Promise<SizeStats> {
  let buildContext: BuildContext | undefined
  try {
    // cliEntryPath decides `isFromCli` and can override the source of the
    // `./index` entry, so it has to be replayed here — otherwise this worker
    // resolves a different set of entries than the main thread listed, and
    // the assigned entry silently builds nothing.
    await bundle(cliEntryPath, {
      ...options,
      cwd,
      // The output directory is cleaned once on the main thread before the
      // entries are dispatched; workers run concurrently and must not remove
      // each other's output.
      clean: false,
      _entryFilter: entryNames,
      _callbacks: {
        onBuildStart(context: BuildContext) {
          buildContext = context
        },
      },
    })
  } catch (error) {
    throw toTransferableError(error)
  }
  return buildContext?.pluginContext.outputState.getSizeStats() ?? new Map()
}
