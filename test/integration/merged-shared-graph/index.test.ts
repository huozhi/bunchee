import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Two entries published as both `import` and `require`. The two formats describe
// the same entries, so the modules behind them are parsed, transformed and
// tree-shaken once and the graph is written twice.
const distDir = path.join(__dirname, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', __dirname], { env })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return {
    stdout: result.stdout,
    files: await getFileNamesFromDirectory(distDir),
    contents: await getFileContents(distDir),
  }
}

describe('integration - merged-shared-graph', () => {
  it('should build one graph and write it as both formats', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    expect(stdout).toMatch(/Sharing one graph across 2 outputs/)
    expect(stdout).toMatch(/2 inputs -> esm\+cjs/)
  }, 120_000)

  it('should emit both formats with the shared module as a chunk', async () => {
    const { files, contents } = await build()

    // One chunk per format, rather than a copy of `shared` inlined into each of
    // the four entry files.
    const chunks = files.filter((file) => file.startsWith('shared-'))
    expect(chunks).toHaveLength(2)

    for (const file of ['index.mjs', 'index.js', 'other.mjs', 'other.js']) {
      expect(files).toContain(file)
      expect(contents[file]).toContain('shared-')
      expect(contents[file]).not.toContain(`= 'shared'`)
    }
  }, 120_000)
})
