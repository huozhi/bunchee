import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// A bin entry and an `edge-light` condition alongside plain ones. Neither rules
// merging out: the bin is just another input whose own module gets the shebang,
// and the condition puts its entry in a separate group because it resolves
// sibling imports differently.
const dir = __dirname
const distDir = path.join(dir, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', dir], { env })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return {
    stdout: result.stdout,
    files: await getFileNamesFromDirectory(distDir),
    contents: await getFileContents(distDir),
  }
}

describe('integration - merge-entries-groups', () => {
  it('should merge rather than fall back to one instance per entry', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    expect(stdout).not.toContain('Not merging entries')
    expect(stdout).toMatch(/shared rollup instances/)
  }, 120_000)

  it('should group the edge-light entry apart from the default ones', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    // The condition is part of the group key, so its entry cannot end up in a
    // graph that resolves siblings as the default condition does.
    expect(stdout).toMatch(/Merged group ".*\|default": \d+ entries/)
    expect(stdout).toMatch(/Merged group ".*\|edge-light": \d+ entries/)
  }, 120_000)

  it('should give only the bin output a shebang', async () => {
    const { contents } = await build()

    expect(contents['bin/index.js']).toMatch(/^#!\/usr\/bin\/env node/)
    expect(contents['index.js']).not.toContain('#!/usr/bin/env node')
    expect(contents['edge.js']).not.toContain('#!/usr/bin/env node')
  }, 120_000)

  it('should still build every declared output', async () => {
    const { files } = await build()

    expect(files).toContain('index.js')
    expect(files).toContain('edge.js')
    expect(files).toContain('edge.edge-light.js')
    expect(files).toContain('bin/index.js')
    expect(files).toContain('index.d.ts')
  }, 120_000)
})
