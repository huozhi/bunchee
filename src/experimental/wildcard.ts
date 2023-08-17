import fs from 'fs/promises'
import path from 'path'
import { SRC } from '../constants'
import { ExportCondition } from '../types'
import {
  filenameWithoutExtension,
  hasAvailableExtension,
  nonNullable,
} from '../utils'

const getWildcardEntry = (
  key: string,
  exports: string | Record<string, ExportCondition>,
): string | Record<string, ExportCondition> | undefined => {
  if (typeof exports === 'string') return exports
  if (!key.includes('./*') || !exports[key]) return undefined
  return { [key]: exports[key] }
}

export async function getExportables(cwd: string): Promise<string[]> {
  const dirents = await fs.readdir(path.resolve(cwd, SRC), {
    withFileTypes: true,
  })

  const exportables: (string | undefined)[] = await Promise.all(
    dirents.map(async (dirent) => {
      if (dirent.isDirectory()) {
        // Read inside directory and check if it has an index file
        const innerDirents = await fs.readdir(
          path.join(cwd, SRC, dirent.name),
          {
            withFileTypes: true,
          },
        )
        const hasExportableFile = innerDirents.some(
          ({ name }) => name.startsWith('index') && hasAvailableExtension(name),
        )
        return hasExportableFile ? dirent.name : undefined
      }

      if (
        dirent.isFile() &&
        !dirent.name.startsWith('index') &&
        hasAvailableExtension(dirent.name)
      ) {
        return dirent.name
      }
      return undefined
    }),
  )
  return exportables.filter(nonNullable)
}

export async function validateExports(
  exports: ExportCondition,
  cwd: string,
): Promise<ExportCondition> {
  const wildcardEntry = getWildcardEntry('./*', exports)

  if (!wildcardEntry) return exports
  if (typeof wildcardEntry === 'string') return exports

  const exportables = await getExportables(cwd)
  const wildcardExports = exportables.map((exportable) => {
    const filename = exportable.includes('.')
      ? filenameWithoutExtension(exportable)
      : undefined

    if (!filename) {
      return {
        [`./${exportable}`]: JSON.parse(
          JSON.stringify(wildcardEntry['./*']).replace(
            /\*/g,
            `${exportable}/index`,
          ),
        ),
      }
    }
    return JSON.parse(JSON.stringify(wildcardEntry).replace(/\*/g, filename))
  })

  const resolvedExports = Object.assign(
    {},
    exports,
    ...wildcardExports,
    exports,
  )
  delete resolvedExports['./*']
  return resolvedExports
}
