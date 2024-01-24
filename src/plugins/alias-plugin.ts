import { OutputOptions, Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { filePathWithoutExtension } from '../utils'
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
}: {
  entry: string
  entries: Entries
  entriesAlias: Record<string, string>
  format: OutputOptions['format']
  dts: boolean
}): Plugin {
  let currentDistPath = ''
  const entryAliasWithoutSelf = {
    ...entriesAlias,
    [entry]: null,
  }
  const pathToRelativeDistMap = new Map<string, string>()
  for (const [, exportCondition] of Object.entries(entries)) {
    const {
      import: importCond,
      require: requireCond,
      default: defaultCond,
    } = exportCondition.export
    const firstCond = Object.entries(exportCondition.export).find(
      ([key, cond]) => key !== 'types' && cond != null,
    )?.[1]

    if (dts) {
      const fallbackCond = defaultCond || firstCond
      // For cjs, use require() instead of import
      const firstDistPath =
        (format === 'cjs' ? requireCond : importCond) || fallbackCond

      if (firstDistPath) {
        if (entry !== exportCondition.source) {
          pathToRelativeDistMap.set(exportCondition.source, firstDistPath)
        } else {
          currentDistPath = firstDistPath
        }
      }
    }
  }

  return {
    name: 'alias',
    resolveId: {
      async handler(source, importer, options) {
        const resolvedId = await this.resolve(source, importer, options)
        if (resolvedId != null) {
          if (dts) {
            // For types, generate relative path to the other type files,
            // this will be compatible for the node10 ts module resolution.
            const aliasedId = pathToRelativeDistMap.get(resolvedId.id)

            if (aliasedId != null && aliasedId !== currentDistPath) {
              const ext = path.extname(aliasedId)
              const filePathBase = filePathWithoutExtension(
                path.relative(path.dirname(currentDistPath), aliasedId),
              )!
              const relativePath = relativify(filePathBase + ext)
              return { id: relativePath, external: true }
            }
          } else {
            const aliasedId = entryAliasWithoutSelf[resolvedId.id]

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
