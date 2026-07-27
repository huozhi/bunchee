import path from 'path'
import { describe, expect, it } from 'vitest'
import { getFileContents, removeDirectory } from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

// Four entries at different depths whose declarations reference each other. When
// the types are split across shards, a sibling in another shard is external and
// its specifier has to be relative to the importing chunk — `../mid/index.js`
// from `top/`, but `../../mid/index.js` from `nest/deep/`.
const dir = __dirname
const distDir = path.join(dir, 'dist')

async function build(env: NodeJS.ProcessEnv = {}) {
  await removeDirectory(distDir)
  const result = await executeBunchee(['--cwd', dir], { env })
  expect(result.stderr).toBe('')
  expect(result.code).toBe(0)
  return await getFileContents(distDir)
}

function declarations(contents: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(contents).filter(([file]) => file.endsWith('.d.ts')),
  )
}

describe('integration - merge-entries-shards', () => {
  it('should resolve cross-entry type references relative to each entry', async () => {
    const contents = await build()

    expect(contents['top/index.d.ts']).toContain(`from '../mid/index.js'`)
    expect(contents['nest/deep/index.d.ts']).toContain(
      `from '../../mid/index.js'`,
    )
  }, 120_000)

  it('should emit the same declarations however the types are sharded', async () => {
    const oneShard = declarations(await build({ BUNCHEE_DTS_SHARDS: '1' }))
    // More shards than entries, so every entry lands in a shard of its own and
    // every cross-entry reference has to cross a shard boundary.
    const manyShards = declarations(await build({ BUNCHEE_DTS_SHARDS: '8' }))

    // One graph holding every entry, against every entry in a shard of its own
    // so each cross-entry reference crosses a boundary.
    expect(manyShards).toEqual(oneShard)

    // A specifier is posix on every platform. Comparing the three runs to each
    // other would not catch a Windows path leaking in, since all three would
    // carry it.
    for (const content of Object.values(manyShards)) {
      expect(content).not.toMatch(/from '[^']*\\/)
    }
  }, 240_000)
})
