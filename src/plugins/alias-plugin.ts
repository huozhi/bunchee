import { OutputOptions, Plugin } from 'rollup'
import { Entries } from '../types'
import path from 'path'
import { relativify } from '../lib/format'
import { getSpecialExportTypeFromConditionNames } from '../entries'
import { specialExportConventions } from '../constants'

function hasNoSpecialCondition(conditionNames: Set<string>) {
  return [...conditionNames].every(
    (name) => !specialExportConventions.has(name),
  )
}

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
    conditionNames.has(specialCondition) ||
    (!conditionNames.has('default') && hasNoSpecialCondition(conditionNames))

  return (
    isMatchedConditionWithFormat &&
    !isTypesCondName &&
    hasBundle &&
    isMatchedFormat
  )
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
  conditionNames,
  entries,
  format,
  dts,
  cwd,
}: {
  entry: string
  entries: Entries
  format: OutputOptions['format']
  conditionNames: Set<string>
  dts: boolean
  cwd: string
}): Plugin {
  // <imported source file path>: <relative path to source's bundle>
  const sourceToRelativeBundleMap = new Map<string, string>()
  const specialCondition =
    getSpecialExportTypeFromConditionNames(conditionNames)
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
      matchedBundlePath = exportMapEntries.find((item) => {
        return findJsBundlePathCallback(item, specialCondition)
      })?.bundlePath
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
