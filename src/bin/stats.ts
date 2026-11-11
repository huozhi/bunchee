import path from 'path'
import {
  normalizeExportName,
  type OutputState,
  type StatsOutput,
} from '../plugins/output-state-plugin'
import { getStatsMessages, type StatsMessage } from '../logger'
import { isPrivateExportPath, normalizePath } from '../utils'

export type Stats = {
  version: 1
  bunchee: string
  status: 'success' | 'error'
  /** Export path -> files built for it. */
  exports: Record<string, string[]>
  outputs: StatsOutput[]
  warnings: StatsMessage[]
  errors: StatsMessage[]
}

export function createStats({
  version,
  status,
  outputState,
}: {
  version: string
  status: Stats['status']
  outputState?: OutputState
}): Stats {
  const outputs = outputState?.getStatsOutputs() ?? []
  const exports: Stats['exports'] = {}
  for (const output of outputs) {
    if (!output.export) continue
    if (isPrivateExportPath(output.export)) {
      delete output.export
      continue
    }
    // Same names as the export column of the default build table, e.g.
    // `./client`, `./client (react-server)`, `my-cli (bin)`.
    output.export = normalizeExportName(output.export)
    ;(exports[output.export] ??= []).push(output.file)
  }
  const { warnings, errors } = getStatsMessages()
  return {
    version: 1,
    bunchee: version,
    status,
    exports,
    outputs,
    warnings,
    errors,
  }
}

/** A build error as a stats message: keeps the rollup code and location. */
export function errorToStatsMessage(error: any, cwd: string): StatsMessage {
  const message: StatsMessage = {
    // SWC appends a native stack backtrace that only helps debugging SWC.
    message: String(error?.message ?? error).replace(
      /\n+Stack backtrace:[\s\S]*$/,
      '',
    ),
  }
  const code =
    error?.code && error.code !== 'PLUGIN_ERROR'
      ? error.code
      : typeof error?.name === 'string' && error.name.startsWith('BUNCHEE_')
        ? error.name
        : undefined
  if (code) message.code = code
  const file = error?.loc?.file ?? error?.id
  if (typeof file === 'string') {
    message.file = normalizePath(
      path.isAbsolute(file) ? path.relative(cwd, file) : file,
    )
  }
  if (typeof error?.loc?.line === 'number') message.line = error.loc.line
  if (typeof error?.loc?.column === 'number') message.column = error.loc.column
  return message
}
