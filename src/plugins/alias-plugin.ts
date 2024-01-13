import { Plugin } from 'rollup'

// Alias entries to import path
// e.g.
// For a resolved file, if it's one of the entries,
// aliases it as export path, such as <absolute file> -> <pkg>/<export path>
export function aliasEntries({
  entries,
}: {
  entries: Record<string, string | null>
}): Plugin {
  return {
    name: 'alias',
    resolveId: {
      async handler(source, importer, options) {
        const resolvedId = await this.resolve(source, importer, options)
        if (resolvedId != null) {
          const aliasedId = entries[resolvedId.id]

          if (aliasedId != null) {
            return { id: aliasedId, external: true }
          }
        }
        return null
      },
    },
  }
}
