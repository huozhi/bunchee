import { describe, expect, it } from 'vitest'
import {
  assertFilesContent,
  createJob,
  getFileNamesFromDirectory,
} from '../../testing-utils'

// `_`-prefixed files are built so that entries can share one emitted copy of a
// module. `src/_codegen.js` is shared by nothing — it is a build-time script —
// so building it would only add its imports to the module graph and its output
// to dist.
describe('integration private-module-unreachable', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should build only the private module an export reaches', async () => {
    expect(await getFileNamesFromDirectory(distDir)).toEqual([
      '_shared.js',
      'used.js',
    ])
  })

  it('should still link the reached private module', async () => {
    await assertFilesContent(distDir, {
      'used.js': `'./_shared.js'`,
    })
  })
})
