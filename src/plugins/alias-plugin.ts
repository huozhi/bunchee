import { OutputOptions, Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { relativify } from '../lib/format'
import { getSpecialExportTypeFromSourcePath } from '../entries'

function findJsBundlePathCallback(
  {
    format,
    bundlePath,
    conditionNames,
  }: {
    format: OutputOptions['format']
    bundlePath: string
    conditionNames: Set<string>
  },
  specialCondition: string,
) {
  const hasBundle = bundlePath != null
  const formatCond = format === 'cjs' ? 'require' : 'import'

  const isTypesCondName = conditionNames.has('types')
  const hasFormatCond =
    conditionNames.has('import') || conditionNames.has('require')

  const isMatchedFormat = hasFormatCond ? conditionNames.has(formatCond) : true

  const isMatchedConditionWithFormat =
    specialCondition !== 'default'
      ? // If there's special condition, fallback to default condition if the exportsMap doesn't have the special condition;
        conditionNames.has(specialCondition) || isMatchedFormat
      : // If there's no special, just match the default condition with expected format.
        isMatchedFormat

  return isMatchedConditionWithFormat && !isTypesCondName && hasBundle
}

function findTypesFileCallback({
  format,
  bundlePath,
  conditionNames,
}: {
  format: OutputOptions['format'] | undefined
  bundlePath: string
  conditionNames: Set<string>
}) {
  const hasCondition = bundlePath != null
  const formatCond = format ? (format === 'cjs' ? 'require' : 'import') : null
  const isTypesCondName = conditionNames.has('types')
  return (
    isTypesCondName &&
    hasCondition &&
    (formatCond ? conditionNames.has(formatCond) : true)
  )
}

// Alias entry key to dist bundle path
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
  // <imported source file path>: <relative path to source's bundle>
  const sourceToRelativeBundleMap = new Map<string, string>()
  for (const [, exportCondition] of Object.entries(entries)) {
    const exportDistMaps = exportCondition.export
    const exportMapEntries = Object.entries(exportDistMaps).map(
      ([composedKey, bundlePath]) => ({
        conditionNames: new Set(composedKey.split('.')),
        bundlePath,
        format,
      }),
    )

    let matchedBundlePath: string | undefined
    if (dts) {
      // Find the type with format condition first
      matchedBundlePath = exportMapEntries.find(findTypesFileCallback)
        ?.bundlePath
      // If theres no format specific types such as import.types or require.types,
      // fallback to the general types file.
      if (!matchedBundlePath) {
        matchedBundlePath = exportMapEntries.find((item) => {
          return findTypesFileCallback({
            ...item,
            format: undefined,
          })
        })?.bundlePath
      }
    } else {
      const specialCondition =
        getSpecialExportTypeFromSourcePath(sourceFilePath)
      matchedBundlePath = exportMapEntries.find((item) =>
        findJsBundlePathCallback(item, specialCondition),
      )?.bundlePath
    }

    if (matchedBundlePath) {
      if (!sourceToRelativeBundleMap.has(exportCondition.source))
        sourceToRelativeBundleMap.set(exportCondition.source, matchedBundlePath)
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
          let srcBundle = sourceToRelativeBundleMap.get(sourceFilePath)
          // Resolved module bundle path
          let resolvedModuleBundle = sourceToRelativeBundleMap.get(resolved.id)

          if (
            resolved.id !== sourceFilePath &&
            srcBundle &&
            resolvedModuleBundle
          ) {
            const absoluteBundlePath = path.resolve(cwd, srcBundle)
            const absoluteImportBundlePath = path.resolve(
              cwd,
              resolvedModuleBundle,
            )

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
