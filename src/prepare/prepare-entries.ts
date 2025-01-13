import { existsSync } from 'fs'
import { glob } from 'tinyglobby'
import {
  BINARY_TAG,
  PRIVATE_GLOB_PATTERN,
  TESTS_GLOB_PATTERN,
  availableExtensions,
} from '../constants'

import { collectSourceEntriesByExportPath } from '../entries'
import { normalizePath, sourceFilenameToExportFullPath } from '../utils'

// For `prepare` command
export async function collectSourceEntries(sourceFolderPath: string) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, Record<string, string>>()
  if (!existsSync(sourceFolderPath)) {
    return {
      bins,
      exportsEntries,
    }
  }

  // Match with global patterns
  // bin/**/*.<ext>, bin/**/index.<ext>
  const binPattern = `bin/**/*.{${[...availableExtensions].join(',')}}`
  const srcPattern = `**/*.{${[...availableExtensions].join(',')}}`

  const binMatches = await glob(binPattern, {
    cwd: sourceFolderPath,
    ignore: [PRIVATE_GLOB_PATTERN, TESTS_GLOB_PATTERN], // ignore private entries
  })

  const srcMatches = await glob(srcPattern, {
    cwd: sourceFolderPath,
    ignore: [PRIVATE_GLOB_PATTERN, TESTS_GLOB_PATTERN], // ignore private entries
  })

  for (const file of binMatches) {
    // convert relative path to export path
    const exportPath = sourceFilenameToExportFullPath(normalizePath(file))
    const binExportPath = exportPath.replace(/^\.[\//]bin/, BINARY_TAG)
    await collectSourceEntriesByExportPath(
      sourceFolderPath,
      binExportPath,
      bins,
      exportsEntries,
    )
  }

  for (const file of srcMatches) {
    const binExportPath = normalizePath(file)
      .replace(/^bin/, BINARY_TAG)
      // Remove index.<ext> to [^index].<ext> to build the export path
      .replace(/(\/index)?\.[^/]+$/, '')

    await collectSourceEntriesByExportPath(
      sourceFolderPath,
      binExportPath,
      bins,
      exportsEntries,
    )
  }

  return {
    bins,
    exportsEntries,
  }
}
