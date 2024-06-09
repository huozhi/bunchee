import { OutputOptions, Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { relativify } from '../lib/format'

// Alias entries to import path
// e.g.
// For a resolved file, if it's one of the entries,
// aliases it as export path, such as <absolute file> -> <pkg>/<export path>
export function aliasEntries({
  entry: sourceFilePath,
  entries,
  format,
  dts,
  cwd,
}: {
  entry: string
  entries: Entries
  format: OutputOptions['format']
  dts: boolean
  cwd: string
}): Plugin {
  const pathToRelativeDistMap = new Map<string, string>()
  for (const [, exportCondition] of Object.entries(entries)) {
    const exportDistMaps = exportCondition.export
    const exportMapEntries = Object.entries(exportDistMaps)

    const matchedBundlePath = exportMapEntries.find(([composedKey, cond]) => {
      const hasCondition = cond != null
      const conditionNames = new Set(composedKey.split('.'))
      const formatCond = format === 'cjs' ? 'require' : 'import'
      const isTypesCondName = conditionNames.has('types')

      if (dts) {
        return isTypesCondName && hasCondition
      } else {
        const isMatchedFormat = conditionNames.has(formatCond)
        return isMatchedFormat && !isTypesCondName && hasCondition
      }
    })?.[1]

    if (matchedBundlePath) {
      if (!pathToRelativeDistMap.has(exportCondition.source))
        pathToRelativeDistMap.set(exportCondition.source, matchedBundlePath)
    }
  }

  return {
    name: 'alias',
    resolveId: {
      async handler(source, importer, options) {
        const resolved = await this.resolve(source, importer, options)

        if (resolved != null) {
          // For types, generate relative path to the other type files,
          // this will be compatible for the node10 ts module resolution.
          const srcBundlePath = pathToRelativeDistMap.get(sourceFilePath)
          // Resolved module bundle path
          const importBundlePath = pathToRelativeDistMap.get(resolved.id)
          // console.log('pathToRelativeDistMap', 'entry', basename( sourceFilePath), 'entryDist', relativeBundlePath, 'resolved.id', resolved.id)
          if (
            resolved.id !== sourceFilePath &&
            srcBundlePath &&
            importBundlePath
          ) {
            const absoluteBundlePath = path.resolve(cwd, srcBundlePath)
            const absoluteImportBundlePath = path.resolve(cwd, importBundlePath)

            const filePathBase = path.relative(
              path.dirname(absoluteBundlePath),
              absoluteImportBundlePath,
            )!
            const relativePath = relativify(filePathBase)
            return { id: relativePath, external: true }
          }
        }
        return null
      },
    },
  }
}
