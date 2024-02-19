import fs from 'fs'
import fsp from 'fs/promises'
import path, { join } from 'path'
import { getExportTypeFromFile, type ParsedExportsInfo } from './exports'
import { PackageMetadata, type Entries, ExportPaths } from './types'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  getSourcePathFromExportPath,
  hasAvailableExtension,
  isTestFile,
  resolveSourceFile,
} from './utils'
import { availableExtensions, SRC } from './constants'

export async function collectEntriesFromParsedExports(
  pkg: PackageMetadata,
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
): Promise<Entries> {
  const entries: Entries = {}
  const { bins, exportsEntries } = await collectSourceEntries(join(cwd, SRC))

  for (const [bin, binDistPath] of bins) {
    const sourceFile = await resolveSourceFile(cwd, binDistPath)

    const exportType = getExportTypeFromFile(binDistPath, pkg.type)
    entries[bin] = {
      source: await resolveSourceFile(cwd, binDistPath),
      name: bin,
      export: {
        [exportType]: binDistPath,
      },
    }
  }
  // for (const [exportPath, exportInfo] of Object.entries(parsedExportsInfo)) {
  //   if (exportPath === './package.json') {
  //     continue
  //   }

  // }

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
  const exportsEntries = new Map<string, string>()
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
            const binName = baseNameWithoutExtension(binDirent.name)
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
          const indexFile = path.join(dirent.name, `index.${extension}`)
          if (fs.existsSync(indexFile) && !isTestFile(indexFile)) {
            exportsEntries.set(dirent.name, indexFile)
            break
          }
        }
      }
    } else if (dirent.isFile()) {
      const isAvailableExtension = availableExtensions.has(
        path.extname(dirent.name).slice(1),
      )
      if (isAvailableExtension) {
        const baseName = baseNameWithoutExtension(dirent.name)
        const isBinFile = baseName === 'bin'
        if (isBinFile) {
          bins.set('.', dirent.name)
        } else {
          if (hasAvailableExtension(dirent.name) && !isTestFile(dirent.name)) {
            exportsEntries.set(baseName, dirent.name)
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
