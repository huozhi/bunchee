import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// `widget.ts` carries `'use client'` and is reached from both a server-layer
// entry (`.`) and a client-layer one (`./ui`). One graph holding both entries
// only gets to place that module once, so it has to land in its own chunk for
// the boundary to survive — inlining it into `ui` would leave the server entry
// importing client code directly.
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
    // The chunk has to carry the directive, or the boundary is lost.
    expect(contents[chunk!]).toMatch(/^'use client'/)
    // Neither entry inlines it; both reach it through the chunk.
    expect(contents['index.js']).toContain(`from './${chunk}'`)
    expect(contents['ui.js']).toContain(`from './${chunk}'`)
    expect(contents['index.js']).not.toContain('function Widget')
    expect(contents['ui.js']).not.toContain('function Widget')
  }, 120_000)

  it('should not put a directive on the server-layer entry', async () => {
    const { contents } = await build()

    // `index.ts` has no directive of its own and must not pick one up from the
    // client module it re-exports.
    expect(contents['index.js']).not.toContain(`'use client'`)
    expect(contents['ui.js']).toMatch(/^'use client'/)
  }, 120_000)

  it('should build both entries as one graph', async () => {
    const { stdout } = await build({ DEBUG: '1' })

    expect(stdout).toMatch(/Building 2 entries in \d+ shared rollup instances/)
  }, 120_000)
})
