import type { Entries } from '../../types'
import type { OutputState, SizeStats } from '../../plugins/output-state-plugin'
import { createOutputState } from '../../plugins/output-state-plugin'
import prettyBytes from 'pretty-bytes'
import { dirname, join, relative } from 'path'
import { normalizePath } from '../../utils'
import { logger } from '../../logger'

type InternalFile = { source: string; bytes: number; asset: boolean }

/** Reuse the ordinary entry table; collect preserved files in a separate summary. */
export function createUnbundleOutputState(entries: Entries): OutputState {
  const publicEntries = createOutputState({ entries })
  const sources = new Map(
    Object.entries(entries).map(([name, entry]) => [
      entry.source,
      name.replace(/^@[^/]+\//, ''),
    ]),
  )
  const internal = new Map<string, InternalFile>()
  return {
    ...publicEntries,
    plugin(cwd) {
      return {
        name: 'unbundle-sizes',
        writeBundle(options, bundle) {
          const dir = options.dir ?? dirname(options.file!)
          const reported: SizeStats = new Map()
          for (const [name, file] of Object.entries(bundle)) {
            const source =
              file.type === 'chunk' ? (file.facadeModuleId ?? name) : name
            const code = file.type === 'chunk' ? file.code : file.source
            const bytes =
              typeof code === 'string'
                ? Buffer.byteLength(code)
                : code.byteLength
            const entry =
              file.type === 'chunk' && file.isEntry
                ? sources.get(source)
                : undefined
            if (entry !== undefined) {
              const files = reported.get(entry) ?? []
              files.push([
                normalizePath(relative(cwd, join(dir, name))),
                normalizePath(source),
                bytes,
              ])
              reported.set(entry, files)
            } else {
              internal.set(join(dir, name), {
                source,
                bytes,
                asset: file.type === 'asset',
              })
            }
          }
          publicEntries.mergeSizeStats(reported)
        },
      }
    },
    log() {
      publicEntries.log()
      const modules = [...internal.values()].filter((file) => !file.asset)
      const assets = [...internal.values()].filter((file) => file.asset)
      if (modules.length) {
        const count = new Set(modules.map((file) => file.source)).size
        console.log(
          `+ ${count} internal ${count === 1 ? 'module' : 'modules'}  ${prettyBytes(modules.reduce((sum, file) => sum + file.bytes, 0))}`,
        )
      }
      if (assets.length)
        console.log(
          `+ ${assets.length} ${assets.length === 1 ? 'asset' : 'assets'}  ${prettyBytes(assets.reduce((sum, file) => sum + file.bytes, 0))}`,
        )
      const vendor = new Set(
        modules
          .map((file) => file.source)
          .filter(
            (source) =>
              !source.startsWith('\0') &&
              source.replace(/\\/g, '/').includes('/node_modules/'),
          ),
      )
      if (vendor.size)
        logger.info(
          `${vendor.size} ${vendor.size === 1 ? 'module' : 'modules'} from node_modules ${vendor.size === 1 ? 'was' : 'were'} inlined to _vendor/`,
        )
    },
  }
}
