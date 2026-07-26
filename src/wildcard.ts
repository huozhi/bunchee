import path from 'path'
import { glob } from 'tinyglobby'
import {
  availableExtensions,
  SRC,
  PRIVATE_GLOB_PATTERNS,
  TESTS_GLOB_PATTERN,
  specialExportConventions,
} from './constants'
import { logger } from './logger'
import { fileExists, normalizePath } from './utils'

/**
 * Check if an export key contains a wildcard pattern
 */
export function hasWildcardPattern(exportKey: string): boolean {
  return exportKey.includes('*')
}

/**
 * Convert a wildcard pattern to a glob pattern for file matching
 * Example: "./features/*" -> "features/*"
 */
export function wildcardPatternToGlob(
  pattern: string,
  sourceDir: string,
): string {
  // Remove leading "./" and convert to glob pattern
  const cleanPattern = pattern.replace(/^\.\//, '')
  return path.posix.join(sourceDir, cleanPattern)
}

/**
 * Replace wildcard in output path with matched subpath
 * Example: "./dist/features/*.js" with "foo" -> "./dist/features/foo.js"
 */
export function substituteWildcardInPath(
  outputPath: string,
  matchedSubpath: string,
): string {
  return outputPath.replace(/\*/g, matchedSubpath)
}

/**
 * Turn a source file path into the subpath it serves, or undefined if it serves none.
 *
 * "features/foo.ts"             -> "features/foo"
 * "features/bar/index.ts"       -> "features/bar"
 * "features/foo.development.ts" -> "features/foo"  (a condition variant, not its own export)
 */
function sourceFileToSubpath(sourceFile: string): string | undefined {
  const relativePath = normalizePath(sourceFile)
  const ext = path.extname(relativePath)
  if (!ext) {
    return undefined
  }
  let subpath = relativePath.slice(0, -ext.length)

  // Strip a trailing export-convention segment, e.g. `foo.development` -> `foo`.
  // Those files are variants of the base export, not exports of their own.
  const segments = path.posix.basename(subpath).split('.')
  if (
    segments.length > 1 &&
    specialExportConventions.has(segments[segments.length - 1])
  ) {
    const dir = path.posix.dirname(subpath)
    const baseName = segments.slice(0, -1).join('.')
    subpath = dir === '.' ? baseName : path.posix.join(dir, baseName)
  }

  // `foo/index.ts` serves `foo`, not `foo/index`.
  if (subpath.endsWith('/index')) {
    subpath = subpath.slice(0, -'/index'.length)
  } else if (subpath === 'index') {
    return undefined
  }

  return subpath || undefined
}

/**
 * Expand a wildcard export pattern by finding matching source files
 * Returns a map of concrete export paths to their matched subpaths
 * Example: "./features/*" with files ["foo.ts", "bar.ts"] in src/features/
 *   -> { "./features/foo": "foo", "./features/bar": "bar" }
 *
 * A `*` may appear anywhere in the key and, per Node's subpath-pattern rules,
 * matches across `/`. So `./feat-*`, `./*\/utils` and deeply nested files under
 * `./features/*` all expand.
 */
export async function expandWildcardPattern(
  wildcardPattern: string,
  cwd: string,
): Promise<Map<string, string>> {
  const expanded = new Map<string, string>()
  const sourceDir = path.join(cwd, SRC)

  if (!fileExists(sourceDir)) {
    return expanded
  }

  // "./features/*" -> "features/*"
  const cleanPattern = wildcardPattern.replace(/^\.\//, '')

  // Node only honours the first `*` in a subpath pattern.
  // "features/*"  -> prefix "features/", suffix ""
  // "feat-*"      -> prefix "feat-",     suffix ""
  // "*/utils"     -> prefix "",          suffix "/utils"
  const starIndex = cleanPattern.indexOf('*')
  if (starIndex === -1) {
    return expanded
  }
  const prefix = cleanPattern.slice(0, starIndex)
  const suffix = cleanPattern.slice(starIndex + 1).replace(/\*/g, '')

  const extPattern = `{${[...availableExtensions].join(',')}}`
  // Narrow the search to the static directory part of the prefix, so
  // `./features/*` only walks `src/features`. A prefix without a directory part
  // (`./feat-*`, `./*/utils`) can match anywhere, so it needs the whole tree.
  const prefixDir = prefix.includes('/')
    ? prefix.slice(0, prefix.lastIndexOf('/') + 1)
    : ''

  let matches: string[] = []
  try {
    matches = await glob([`${prefixDir}**/*.${extPattern}`], {
      cwd: sourceDir,
      ignore: [...PRIVATE_GLOB_PATTERNS, TESTS_GLOB_PATTERN],
      expandDirectories: false,
    })
  } catch (error) {
    logger.warn(
      `Failed to expand wildcard pattern ${wildcardPattern}: ${error}`,
    )
    return expanded
  }

  for (const match of matches) {
    const subpath = sourceFileToSubpath(match)
    if (
      !subpath ||
      !subpath.startsWith(prefix) ||
      !subpath.endsWith(suffix) ||
      // The prefix and suffix must not overlap, otherwise `*` matched nothing.
      subpath.length <= prefix.length + suffix.length
    ) {
      continue
    }

    // What `*` stands for, e.g. "features/nested/deep" -> "nested/deep"
    const matchedSubpath = subpath.slice(
      prefix.length,
      subpath.length - suffix.length,
    )

    expanded.set(`./${subpath}`, matchedSubpath)
  }

  return expanded
}
