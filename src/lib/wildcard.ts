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
import { logger } from '../logger'

// TODO: support nested wildcard exportsCondition (e.g. './foo/*')
const getWildcardExports = (
  exportsCondition: Record<string, ExportCondition>,
): Record<string, ExportCondition> => {
  return { './*': exportsCondition['./*'] }
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

async function getExportables(
  cwd: string,
  excludeKeys: string[],
): Promise<string[]> {
  const pathname = path.resolve(cwd, SRC)
  const dirents = await fs.readdir(pathname, { withFileTypes: true })
  const exportables: (string | undefined)[] = await Promise.all(
    dirents.map(async (dirent) =>
      (await isExportable(dirent, pathname)) &&
      !excludeKeys.includes(dirent.name)
        ? dirent.name
        : undefined,
    ),
  )
  return exportables.filter(nonNullable)
}

function mapWildcard(
  wildcardExports: Record<string, ExportCondition>,
  exportables: string[],
): ExportCondition[] {
  return exportables.map((exportable) => {
    const isFile = exportable.includes('.')
    const filename = isFile ? filenameWithoutExtension(exportable)! : exportable

    return {
      [`./${filename}`]: Object.fromEntries(
        Object.entries(wildcardExports['./*']).map(([key, value]) => [
          key,
          (value as string).replace(
            /\*/g,
            isFile ? filename : `${filename}/index`,
          ),
        ]),
      ),
    }
  })
}

export async function resolveWildcardExports(
  exportsCondition: string | Record<string, ExportCondition> | undefined,
  cwd: string,
): Promise<ExportCondition | undefined> {
  if (!exportsCondition || typeof exportsCondition === 'string')
    return undefined

  const hasWildcard = !!exportsCondition['./*']

  if (hasWildcard) {
    logger.warn(
      `The wildcard export "./*" is experimental and may change or be removed at any time.\n` +
        'To open an issue, please visit https://github.com/huozhi/bunchee/issues' +
        '.\n',
    )

    // './foo' -> ['foo']; './foo/bar' -> ['bar']
    // will contain '*' also but it's not a problem
    const excludeKeys = Object.keys(exportsCondition).map(
      (key) => key.split('/').pop() as string,
    )
    const exportables = await getExportables(cwd, excludeKeys)

    if (exportables.length > 0) {
      const wildcardExports = getWildcardExports(exportsCondition)
      const resolvedWildcardExports = mapWildcard(wildcardExports, exportables)
      const resolvedExports = Object.assign(
        {},
        exportsCondition,
        ...resolvedWildcardExports,
      )

      delete resolvedExports['./*']
      return resolvedExports
    }
  }

  return undefined
}
