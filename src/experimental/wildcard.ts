import fs from 'fs/promises'
import type { Dirent } from 'fs'
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
  exports: Record<string, ExportCondition>,
): Record<string, ExportCondition> | undefined => {
  if (!key.includes('./*') || !exports[key]) return undefined
  return { [key]: exports[key] }
}

const isExportable = async (
  dirent: Dirent,
  pathname: string,
): Promise<boolean> => {
  if (dirent.isDirectory()) {
    const innerDirents = await fs.readdir(path.join(pathname, dirent.name), {
      withFileTypes: true,
    })
    return innerDirents.some(
      ({ name }) => name.startsWith('index') && hasAvailableExtension(name),
    )
  }
  return (
    dirent.isFile() &&
    !dirent.name.startsWith('index') &&
    hasAvailableExtension(dirent.name)
  )
}

async function getExportables(cwd: string): Promise<string[]> {
  const pathname = path.resolve(cwd, SRC)
  const dirents = await fs.readdir(pathname, { withFileTypes: true })
  const exportables: (string | undefined)[] = await Promise.all(
    dirents.map(async (dirent) =>
      (await isExportable(dirent, pathname)) ? dirent.name : undefined,
    ),
  )
  return exportables.filter(nonNullable)
}

function mapWildcard(
  wildcardEntry: string | Record<string, ExportCondition>,
  exportables: string[],
): (string | ExportCondition)[] {
  return exportables.map((exportable) => {
    const filename = exportable.includes('.')
      ? filenameWithoutExtension(exportable)
      : undefined

    if (!filename) {
      if (typeof wildcardEntry === 'string') {
        return wildcardEntry.replace(/\*/g, exportable)
      }
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
}

export async function validateExports(
  exports: ExportCondition | Record<string, ExportCondition>,
  cwd: string,
): Promise<ExportCondition> {
  if (typeof exports === 'string') return exports
  const wildcardEntry = getWildcardEntry('./*', exports)
  if (!wildcardEntry) return exports

  const exportables = await getExportables(cwd)
  const resolvedWildcardExports = mapWildcard(wildcardEntry, exportables)

  const resolvedExports = Object.assign(
    {},
    exports,
    ...resolvedWildcardExports,
    exports,
  )
  delete resolvedExports['./*']
  return resolvedExports
}
