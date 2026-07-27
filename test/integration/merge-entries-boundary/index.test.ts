import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// `widget.ts` carries `'use client'` and is reached from both a server-layer
// entry (`.`) and a client-layer one (`./ui`). A per-entry build decides where
// it lands once per entry, so it is inlined into `ui.js` and split into its own
// boundary chunk for `index.js`. One shared graph only gets to decide once, so
// bunchee has to fall back for this package rather than flatten the boundary.
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

describe('integration - merge-entries-boundary', () => {
  afterAll(async () => {
    if (!process.env.TEST_NOT_CLEANUP) {
      await removeDirectory(distDir)
    }
  })

  it('should keep the client module in its own boundary chunk', async () => {
    const { files, contents } = await build()

    const chunk = files.find((file) => file.startsWith('widget-'))
    expect(chunk).toBeDefined()
    expect(contents[chunk!]).toContain(`'use client'`)
    expect(contents['index.js']).toContain(`from './${chunk}'`)
  }, 120_000)

  it('should not merge a package with boundary directives', async () => {
    const merged = await build({ DEBUG: '1' })

    expect(merged.stdout).toContain(
      `Not merging entries into shared rollup instances: package uses 'use client' / 'use server' boundaries`,
    )
    expect(merged.stdout).not.toMatch(
      /Building \d+ entries in \d+ shared rollup instances/,
    )
  }, 120_000)
})
