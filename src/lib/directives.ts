import fsp from 'fs/promises'
import path from 'path'
import type { Entries } from '../types'
import { SRC } from '../constants'
import { hasAvailableExtension } from '../utils'

// A directive other than 'use strict' gives a module a layer, and layers are
// what `createSplitChunks` uses to decide chunk boundaries. Matching anywhere
// in the file rather than only at the top is deliberate: a false positive only
// costs the worker fan-out, while a false negative would change output.
const DIRECTIVE_REGEX = /^\s*(['"])use (?!strict\1)[a-z][a-z-]*\1\s*;?\s*$/m

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist'])

async function anyFileHasDirective(dir: string): Promise<boolean> {
  let dirents
  try {
    dirents = await fsp.readdir(dir, { withFileTypes: true })
  } catch {
    return false
  }

  const subDirs: string[] = []
  for (const dirent of dirents) {
    const entryPath = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      if (!IGNORED_DIRS.has(dirent.name)) {
        subDirs.push(entryPath)
      }
      continue
    }
    if (!dirent.isFile() || !hasAvailableExtension(dirent.name)) {
      continue
    }
    if (await fileHasDirective(entryPath)) {
      return true
    }
  }

  for (const subDir of subDirs) {
    if (await anyFileHasDirective(subDir)) {
      return true
    }
  }
  return false
}

async function fileHasDirective(filePath: string): Promise<boolean> {
  try {
    return DIRECTIVE_REGEX.test(await fsp.readFile(filePath, 'utf-8'))
  } catch {
    return false
  }
}

/**
 * Whether any source file in the package carries a directive such as
 * 'use client' or 'use server'.
 *
 * Chunk splitting for layered modules depends on state that every entry's
 * build contributes to and reads back (`pluginContext.moduleDirectiveLayerMap`),
 * so those packages have to keep building in one process — a worker only ever
 * sees the modules of the single entry assigned to it, which would split
 * chunks differently.
 */
export async function hasDirectiveLayers(
  cwd: string,
  entries: Entries,
): Promise<boolean> {
  if (await anyFileHasDirective(path.join(cwd, SRC))) {
    return true
  }
  // Entries can point outside of src/, e.g. when the entry file is passed on
  // the command line.
  const srcDir = path.resolve(cwd, SRC)
  const outsideSources = Object.values(entries)
    .map((entry) => entry.source)
    .filter((source) => !path.resolve(source).startsWith(srcDir + path.sep))

  for (const source of outsideSources) {
    if (await fileHasDirective(source)) {
      return true
    }
  }
  return false
}
