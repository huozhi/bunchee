import { Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { filePathWithoutExtension } from '../utils'
import { relativify } from '../lib/format'

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) {
    return ''
  }
  let prefix = strings[0]
  for (const str of strings) {
    for (let i = 0; i < prefix.length; i++) {
      if (prefix[i] !== str[i]) {
        prefix = prefix.slice(0, i)
        break
      }
    }
  }
  return prefix
}

function _findCommonPrefixDirectory(paths: string[]): string {
  const directories = paths.map((path) => {
    const dir = path.split('/')
    dir.pop()
    return dir.join('/')
  })
  return findCommonPrefix(directories)
}

// Alias entries to import path
// e.g.
// For a resolved file, if it's one of the entries,
// aliases it as export path, such as <absolute file> -> <pkg>/<export path>
export function aliasEntries({
  entry,
  entries,
  reversedAlias,
}: {
  entry: string
  entries: Entries
  reversedAlias: Record<string, string | null>
}): Plugin {
  let currentDistPath = ''
  const pathToRelativeDistMap = new Map<string, string>()
  for (const [, exportCondition] of Object.entries(entries)) {
    // const distPaths = Object.values(exportCondition.export)
    const firstDistPath =
      exportCondition.export.import ||
      exportCondition.export.require ||
      exportCondition.export.default

    if (entry !== exportCondition.source) {
      pathToRelativeDistMap.set(exportCondition.source, firstDistPath)
    } else {
      currentDistPath = firstDistPath
    }
  }

  return {
    name: 'alias',
    resolveId: {
      async handler(source, importer, options) {
        const resolvedId = await this.resolve(source, importer, options)
        if (resolvedId != null) {
          const aliasedId = pathToRelativeDistMap.get(resolvedId.id)

          if (aliasedId != null && aliasedId !== currentDistPath) {
            const relativePath = relativify(
              filePathWithoutExtension(
                path.relative(path.dirname(currentDistPath), aliasedId),
              )!,
            )
            return { id: relativePath, external: true }
          }
        }
        return null
      },
    },
  }
}
