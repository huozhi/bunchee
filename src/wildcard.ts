import path from 'path'
import { glob } from 'tinyglobby'
import {
  availableExtensions,
  SRC,
  PRIVATE_GLOB_PATTERN,
  TESTS_GLOB_PATTERN,
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
 * Extract the base path and wildcard segment from a wildcard pattern
 * Example: "./features/*" -> { basePath: "./features", wildcardSegment: "*" }
 */
export function parseWildcardPattern(pattern: string): {
  basePath: string
  wildcardSegment: string
} {
  const parts = pattern.split('*')
  const basePath = parts[0].replace(/\/$/, '') || '.'
  const wildcardSegment = parts[1] || ''
  return { basePath, wildcardSegment }
}

/**
 * Expand a wildcard export pattern by finding matching source files
 * Returns a map of concrete export paths to their matched subpaths
 * Example: "./features/*" with files ["foo.ts", "bar.ts"] in src/features/
 *   -> { "./features/foo": "foo", "./features/bar": "bar" }
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

  // Convert wildcard pattern to glob pattern
  // "./features/*" -> "features/*"
  const cleanPattern = wildcardPattern.replace(/^\.\//, '')

  // Extract the base path before the wildcard
  // "features/*" -> "features"
  const basePathParts = cleanPattern.split('*')
  const basePath = basePathParts[0].replace(/\/$/, '')

  // Build glob pattern to match files
  // "features/*" -> "features/*.{js,ts,tsx,...}"
  const extPattern = `{${[...availableExtensions].join(',')}}`
  const globPatterns = [
    `${cleanPattern}.${extPattern}`,
    `${cleanPattern}/index.${extPattern}`,
  ]

  try {
    const matches = await glob(globPatterns, {
      cwd: sourceDir,
      ignore: [PRIVATE_GLOB_PATTERN, TESTS_GLOB_PATTERN],
      expandDirectories: false,
    })

    for (const match of matches) {
      // Extract the matched subpath
      // "features/foo.ts" -> "foo"
      // "features/bar/index.ts" -> "bar"
      const relativePath = normalizePath(match)
      const ext = path.extname(relativePath)
      const withoutExt = relativePath.slice(0, -ext.length)

      // Remove the base path to get just the matched part
      // "features/foo" -> "foo" (when basePath is "features")
      let matchedPart = withoutExt
      if (basePath && matchedPart.startsWith(basePath + '/')) {
        matchedPart = matchedPart.slice(basePath.length + 1)
      } else if (basePath && matchedPart === basePath) {
        // This shouldn't happen, but handle it
        continue
      }

      // Handle index files
      let matchedSubpath: string
      if (matchedPart.endsWith('/index')) {
        matchedSubpath = matchedPart.slice(0, -6) // Remove "/index"
        // If there's still a path, take the last segment
        const lastSlash = matchedSubpath.lastIndexOf('/')
        matchedSubpath =
          lastSlash >= 0 ? matchedSubpath.slice(lastSlash + 1) : matchedSubpath
      } else {
        // Take the first segment (what matches the *)
        const firstSlash = matchedPart.indexOf('/')
        matchedSubpath =
          firstSlash >= 0 ? matchedPart.slice(0, firstSlash) : matchedPart
      }

      // Build the concrete export path
      // "./features/*" + "foo" -> "./features/foo"
      const concreteExportPath = basePath
        ? `./${basePath}/${matchedSubpath}`
        : `./${matchedSubpath}`

      expanded.set(concreteExportPath, matchedSubpath)
    }
  } catch (error) {
    logger.warn(
      `Failed to expand wildcard pattern ${wildcardPattern}: ${error}`,
    )
  }

  return expanded
}
