import fs from 'fs'
import fsp from 'fs/promises'
import path, { join } from 'path'
import { getExportTypeFromFile, type ParsedExportsInfo } from './exports'
import { PackageMetadata, type Entries, ExportPaths } from './types'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  findSourceEntryFile,
  getSourcePathFromExportPath,
  hasAvailableExtension,
  isTestFile,
  joinRelativePath,
  resolveSourceFile,
} from './utils'
import {
  availableExtensions,
  SRC,
  suffixedExportConventions,
} from './constants'
import { relativify } from './lib/format'

// shared.ts -> ./shared
// shared.<export condition>.ts -> ./shared
function sourceFilenameToExportPath(filename: string) {
  const baseName = baseNameWithoutExtension(filename)
  let exportPath = baseName
  for (const specialExportType of suffixedExportConventions) {
    if (exportPath.endsWith('.' + specialExportType)) {
      exportPath = exportPath.slice(0, -1 - specialExportType.length)
      break
    }
  }
  return relativify(exportPath)
}

export async function collectEntriesFromParsedExports(
  pkg: PackageMetadata,
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
): Promise<Entries> {
  const entries: Entries = {}
  // Find source files
  const { bins, exportsEntries } = await collectSourceEntries(join(cwd, SRC))
  console.log('bins', bins, 'exportsEntries', exportsEntries)
  // Traverse source files and try to match the entries
  // Find exports from parsed exports info

  for (const [exportPath, sourceFiles] of exportsEntries) {
    const outputExports = parsedExportsInfo.get(exportPath)
    if (!outputExports) {
      continue
    }

    for (const [outputPath, exportType] of outputExports) {
      for (const sourceFile of sourceFiles) {
        entries[exportPath] = {
          source: sourceFile,
          name: exportPath,
          export: {
            [exportType]: outputPath,
          },
        }
      }
    }
  }

  for (const [exportPath, sourceFile] of bins) {
    const outputExports = parsedExportsInfo.get(exportPath)
    if (!outputExports) {
      continue
    }

    for (const [outputPath, exportType] of outputExports) {
      entries[exportPath] = {
        source: sourceFile,
        name: exportPath,
        export: {
          [exportType]: outputPath,
        },
      }
    }
  }

  console.log('entries', entries)

  return entries
}

export async function collectBinaries(
  entries: Entries,
  pkg: PackageMetadata,
  cwd: string,
) {
  const binaryExports = pkg.bin

  if (binaryExports) {
    // binDistPaths: [ [ 'bin1', './dist/bin1.js'], [ 'bin2', './dist/bin2.js'] ]
    const binPairs =
      typeof binaryExports === 'string'
        ? [['bin', binaryExports]]
        : Object.keys(binaryExports).map((key) => [
            join('bin', key),
            binaryExports[key],
          ])

    const binExportPaths = binPairs.reduce((acc, [binName, binDistPath]) => {
      const exportType = getExportTypeFromFile(binDistPath, pkg.type)

      acc[binName] = {
        [exportType]: binDistPath,
      }
      return acc
    }, {} as ExportPaths)

    for (const [binName] of binPairs) {
      const source = await getSourcePathFromExportPath(cwd, binName, '$binary')

      if (!source) {
        logger.warn(`Cannot find source file for ${binName}`)
        continue
      }

      const binEntryPath = await resolveSourceFile(cwd, source)
      entries[binName] = {
        source: binEntryPath,
        name: binName,
        export: binExportPaths[binName],
      }
    }
  }
}

export async function collectSourceEntries(sourceFolderPath: string) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, string[]>()
  const entryFileDirentList = await fsp.readdir(sourceFolderPath, {
    withFileTypes: true,
  })
  for (const dirent of entryFileDirentList) {
    if (dirent.isDirectory()) {
      if (dirent.name === 'bin') {
        const binDirentList = await fsp.readdir(
          path.join(sourceFolderPath, dirent.name),
          {
            withFileTypes: true,
          },
        )
        for (const binDirent of binDirentList) {
          if (binDirent.isFile()) {
            const binFileAbsolutePath = path.join(
              sourceFolderPath,
              dirent.name,
              binDirent.name,
            )
            const binName = sourceFilenameToExportPath(binDirent.name)
            if (fs.existsSync(binFileAbsolutePath)) {
              bins.set(
                binName,
                binFileAbsolutePath,
                // binDirent.name
              )
            }
          }
        }
      } else {
        // Search folder/<index>.<ext> convention entries
        for (const extension of availableExtensions) {
          const indexAbsoluteFile = path.join(
            dirent.path,
            dirent.name,
            `index.${extension}`,
          )
          if (
            fs.existsSync(indexAbsoluteFile) &&
            !isTestFile(indexAbsoluteFile)
          ) {
            const exportPath = sourceFilenameToExportPath(dirent.name)
            const sourceFiles = exportsEntries.get(exportPath) || []
            sourceFiles.push(indexAbsoluteFile)
            exportsEntries.set(exportPath, sourceFiles)
            break
          }
        }
      }
    } else if (dirent.isFile()) {
      const isAvailableExtension = availableExtensions.has(
        path.extname(dirent.name).slice(1),
      )
      if (isAvailableExtension) {
        const baseName = sourceFilenameToExportPath(dirent.name)
        const isBinFile = baseName === 'bin'
        const fullPath = path.join(sourceFolderPath, dirent.name)
        if (isBinFile) {
          bins.set('.', fullPath)
        } else {
          if (hasAvailableExtension(dirent.name) && !isTestFile(dirent.name)) {
            const exportPaths = exportsEntries.get(baseName) || []
            exportPaths.push(fullPath)
            exportsEntries.set(baseName, exportPaths)
          }
        }
      }
    }
  }

  return {
    bins,
    exportsEntries,
  }
}
