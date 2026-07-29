import { OutputOptions, Plugin } from 'rollup'
import { Entries, ParsedExportCondition } from '../types'
import { dirname, posix, relative, resolve } from 'path'
import { posixRelativify } from '../lib/format'
import { getSpecialExportTypeFromConditionNames } from '../entries'
import {
  specialExportConventions,
  runtimeExportConventionsFallback,
} from '../constants'
import { normalizePath } from '../utils'

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
  isESMPkg: boolean,
): boolean {
  const hasBundle = bundlePath != null
  const formatCond = format === 'cjs' ? 'require' : 'import'

  const isTypesCondName = conditionNames.has('types')
  const hasFormatCond =
    conditionNames.has('import') || conditionNames.has('require')

  // Check if the format condition is matched:
  // if there's condition existed, check if the format condition is matched;
  // if there's no condition, just return true, assuming format doesn't matter;
  const bundleFormat = bundlePath.endsWith('.mjs')
    ? 'esm'
    : bundlePath.endsWith('.cjs')
      ? 'cjs'
      : isESMPkg
        ? 'esm'
        : 'cjs'

  // If there's only default condition, and the format is matched
  const isDefaultOnlyCondition =
    conditionNames.size === 1 && conditionNames.has('default')
      ? bundleFormat === format
      : true

  const isMatchedFormat = hasFormatCond ? conditionNames.has(formatCond) : true

  const isMatchedConditionWithFormat =
    // Has matched special condition
    (specialCondition !== 'default' && conditionNames.has(specialCondition)) ||
    // Match normal condition
    hasNoSpecialCondition(conditionNames)

  const match =
    isMatchedConditionWithFormat &&
    !isTypesCondName &&
    hasBundle &&
    isMatchedFormat &&
    isDefaultOnlyCondition

  if (!match) {
    const fallback = runtimeExportConventionsFallback.get(specialCondition)
    if (!fallback) {
      return false
    } else {
      // Match its own condition first,
      // e.g. when import utils.js in index.js
      // In output: index.browser.js should match util.browser.js, fallback to util.js
      // The last guard condition is to ensure bundle condition but not types file.
      return (
        isMatchedFormat &&
        !isTypesCondName &&
        ((specialCondition !== 'default' &&
          conditionNames.has(specialCondition)) ||
          fallback.some((name) => conditionNames.has(name)))
      )
    }
  } else {
    return match
  }
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

/**
 * Marks an import of a sibling entry that this build does not own. The correct
 * specifier is relative to the importing chunk, which is only known once the
 * chunk has a file name, so the absolute target is parked behind this prefix
 * and resolved in `renderChunk`.
 */
const SIBLING_MARK = '\0bunchee-sibling:'

/**
 * Where each entry's source lands in `dist`, for the output being built.
 *
 * The choice depends on the output format, so this is also what decides whether
 * two outputs can share one module graph: if the map is the same for both, the
 * plugin rewrites imports identically and the graph does not depend on which
 * output follows it.
 */
export function buildSourceToBundleMap({
  entries,
  format,
  isESMPkg,
  exportCondition,
  dts,
}: {
  entries: Entries
  format: OutputOptions['format']
  isESMPkg: boolean
  exportCondition: ParsedExportCondition
  dts: boolean
}): Map<string, string> {
  const currentConditionNames = new Set(
    exportCondition.targets[0]?.conditions ?? [],
  )
  // <imported source file path>: <relative path to source's bundle>
  const sourceToRelativeBundleMap = new Map<string, string>()
  const specialCondition = getSpecialExportTypeFromConditionNames(
    currentConditionNames,
  )
  for (const [, exportCondition] of Object.entries(entries)) {
    const exportMapEntries = exportCondition.targets.map((target) => ({
      conditionNames: new Set(target.conditions),
      bundlePath: target.path,
      format,
      isDefaultCondition:
        target.conditions.length === 1 && target.conditions[0] === 'default',
    }))

    let matchedBundlePath: string | undefined
    if (dts) {
      // Find the type with format condition first
      matchedBundlePath = exportMapEntries.find(
        findTypesFileCallback,
      )?.bundlePath
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
        return findJsBundlePathCallback(item, specialCondition, isESMPkg)
      })?.bundlePath
    }

    if (matchedBundlePath) {
      if (!sourceToRelativeBundleMap.has(exportCondition.source))
        sourceToRelativeBundleMap.set(exportCondition.source, matchedBundlePath)
    }
  }
  return sourceToRelativeBundleMap
}

// Alias entry key to dist bundle path
export function aliasEntries({
  entry: sourceFilePath,
  exportCondition,
  entries,
  isESMPkg,
  format,
  dts,
  cwd,
  mergedSources,
}: {
  entry: string
  entries: Entries
  format: OutputOptions['format']
  isESMPkg: boolean
  exportCondition: ParsedExportCondition
  dts: boolean
  cwd: string
  /**
   * The sources this build owns as inputs. When set, the build is a merged one:
   * rollup emits the references between these itself, and only entries outside
   * the set need rewriting to a `<dist>` path.
   */
  mergedSources?: Set<string>
}): Plugin {
  const sourceToRelativeBundleMap = buildSourceToBundleMap({
    entries,
    format,
    isESMPkg,
    exportCondition,
    dts,
  })

  if (mergedSources) {
    return {
      name: 'alias',
      resolveId: {
        async handler(source, importer, options) {
          const resolved = await this.resolve(source, importer, options)
          if (resolved == null) return null
          // An input of this build: rollup emits the cross-chunk reference.
          if (mergedSources.has(resolved.id)) return null

          const bundlePath = sourceToRelativeBundleMap.get(resolved.id)
          if (!bundlePath) return null
          // Resolved with the platform's own path rules — `cwd` and the dist
          // paths are native, and mixing them with posix helpers treats a
          // Windows path as a single segment.
          return {
            id: SIBLING_MARK + resolve(cwd, bundlePath),
            external: true,
          }
        },
      },
      renderChunk(code, chunk, outputOptions) {
        if (!code.includes(SIBLING_MARK)) return null
        const chunkDir = dirname(
          resolve(outputOptions.dir ?? cwd, chunk.fileName),
        )
        const rewritten = code.replace(
          // The mark is followed by an absolute path, up to the quote that
          // closes the module specifier.
          new RegExp(`${SIBLING_MARK}([^'"]+)`, 'g'),
          (_, target: string) =>
            // The specifier is always posix, whatever the platform's paths are.
            posixRelativify(normalizePath(relative(chunkDir, target))),
        )
        return { code: rewritten, map: null }
      },
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
            const absoluteBundlePath = posix.resolve(cwd, srcBundle)
            const absoluteImportBundlePath = posix.resolve(
              cwd,
              resolvedModuleBundle,
            )

            const filePathBase = posix.relative(
              posix.dirname(absoluteBundlePath),
              absoluteImportBundlePath,
            )!
            const relativePath = posixRelativify(normalizePath(filePathBase))
            return { id: relativePath, external: true }
          }
        }
        return null
      },
    },
  }
}
