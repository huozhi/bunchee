import fsp from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { hasDirectiveLayers } from './directives'
import type { Entries } from '../types'

const tmpDirs: string[] = []

async function createPackage(files: Record<string, string>) {
  const cwd = await fsp.mkdtemp(path.join(os.tmpdir(), 'bunchee-directives-'))
  tmpDirs.push(cwd)
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = path.join(cwd, filePath)
    await fsp.mkdir(path.dirname(fullPath), { recursive: true })
    await fsp.writeFile(fullPath, content)
  }
  return cwd
}

function entriesOf(...sources: string[]): Entries {
  return Object.fromEntries(
    sources.map((source, index) => [
      `./entry-${index}`,
      { source, name: '.', export: {} },
    ]),
  ) as unknown as Entries
}

afterEach(async () => {
  await Promise.all(
    tmpDirs
      .splice(0)
      .map((dir) => fsp.rm(dir, { recursive: true, force: true })),
  )
})

describe('hasDirectiveLayers', () => {
  it('should not report a package without directives', async () => {
    const cwd = await createPackage({
      'src/index.ts': `export const index = 'index'\n`,
      'src/lib/util.ts': `export const util = 'not use client'\n`,
    })
    expect(await hasDirectiveLayers(cwd, entriesOf())).toBe(false)
  })

  it('should ignore use strict', async () => {
    const cwd = await createPackage({
      'src/index.ts': `'use strict'\n\nexport const index = 'index'\n`,
    })
    expect(await hasDirectiveLayers(cwd, entriesOf())).toBe(false)
  })

  it('should find a directive nested under src', async () => {
    const cwd = await createPackage({
      'src/index.ts': `export const index = 'index'\n`,
      'src/lib/deep/context.tsx': `'use client'\n\nexport const ctx = 1\n`,
    })
    expect(await hasDirectiveLayers(cwd, entriesOf())).toBe(true)
  })

  it('should find a double quoted server directive', async () => {
    const cwd = await createPackage({
      'src/action.ts': `"use server"\n\nexport async function act() {}\n`,
    })
    expect(await hasDirectiveLayers(cwd, entriesOf())).toBe(true)
  })

  it('should skip node_modules', async () => {
    const cwd = await createPackage({
      'src/index.ts': `export const index = 'index'\n`,
      'src/node_modules/dep/index.js': `'use client'\n`,
    })
    expect(await hasDirectiveLayers(cwd, entriesOf())).toBe(false)
  })

  it('should check entry sources outside of src', async () => {
    const cwd = await createPackage({
      'src/index.ts': `export const index = 'index'\n`,
      'lib/entry.ts': `'use client'\n\nexport const entry = 1\n`,
    })
    const outsideEntry = path.join(cwd, 'lib/entry.ts')
    expect(await hasDirectiveLayers(cwd, entriesOf(outsideEntry))).toBe(true)
  })
})
