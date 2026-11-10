import path from 'path'
import type { OutputOptions } from 'rollup'
import { SRC } from '../constants'
import fsp from 'fs/promises'

/** Clean each output directory once per build, including across JS/DTS jobs. */
export function createOutputCleaner(cwd: string) {
  const removedDirs = new Set<string>()
  return async ({ dir }: OutputOptions): Promise<void> => {
    if (
      dir &&
      dir !== cwd &&
      dir !== path.resolve(cwd, SRC) &&
      !removedDirs.has(dir)
    ) {
      await removeDir(dir)
      removedDirs.add(dir)
    }
  }
}

async function removeDir(dirPath: string) {
  try {
    const dirStat = await fsp.stat(dirPath)
    if (dirStat.isDirectory()) {
      await fsp.rm(dirPath, { recursive: true, force: true })
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
}
