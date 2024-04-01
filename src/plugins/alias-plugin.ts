import { OutputOptions, Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { relativify } from '../lib/format'

// Alias entries to import path
// e.g.
// For a resolved file, if it's one of the entries,
// aliases it as export path, such as <absolute file> -> <pkg>/<export path>
export function aliasEntries({
  entry,
  entries,
  entriesAlias,
  format,
  dts,
  cwd,
}: {
  entry: string
  entries: Entries
  entriesAlias: Record<string, string>
  format: OutputOptions['format']
  dts: boolean
  cwd: string
}): Plugin {
  const entryAliasWithoutSelf = {
    ...entriesAlias,
    [entry]: null,
  }
  const pathToRelativeDistMap = new Map<string, string>()
  for (const [, exportCondition] of Object.entries(entries)) {
    const exportDistMaps = exportCondition.export

    if (dts) {
      // Search types + [format] condition from entries map
      // e.g. import.types, require.types
      const typeCond = Object.entries(exportDistMaps).find(
        ([composedKey, cond]) => {
          const typesSet = new Set(composedKey.split('.'))
          const formatCond = format === 'cjs' ? 'require' : 'import'
          return (
            typesSet.has('types') && typesSet.has(formatCond) && cond != null
          )
        },
      )?.[1]

      if (typeCond) {
        pathToRelativeDistMap.set(exportCondition.source, typeCond)
      }
    }
  }

  return {
    name: 'alias',
    resolveId: {
      async handler(source, importer, options) {
        const resolved = await this.resolve(source, importer, options)

        if (resolved != null) {
          if (dts) {
            // For types, generate relative path to the other type files,
            // this will be compatible for the node10 ts module resolution.
            const resolvedDist = pathToRelativeDistMap.get(resolved.id)
            const entryDist = pathToRelativeDistMap.get(entry)
            if (resolved.id !== entry && entryDist && resolvedDist) {
              const absoluteEntryDist = path.resolve(cwd, entryDist)
              const absoluteResolvedDist = path.resolve(cwd, resolvedDist)

              const filePathBase = path.relative(
                path.dirname(absoluteEntryDist),
                absoluteResolvedDist,
              )!
              const relativePath = relativify(filePathBase)
              return { id: relativePath, external: true }
            }
          } else {
            const aliasedId = entryAliasWithoutSelf[resolved.id]

            if (aliasedId != null) {
              return { id: aliasedId }
            }
          }
        }
        return null
      },
    },
  }
}
