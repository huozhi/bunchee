import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration server-components', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for each exports', async () => {
    const jsFiles = await getFileNamesFromDirectory(distDir)

    expect(jsFiles).toEqual([
      'index.cjs',
      'index.js',
      'mod_actions-gdr5hg8y.js',
      'mod_actions-gnku5pdq.cjs',
      // `mod_asset` carries 'use client' and is reached from `ui` only, but one
      // graph places it once, so it gets a boundary chunk rather than being
      // inlined into that entry.
      'mod_asset-bssczhru.js',
      'mod_asset-hfdpjgz4.cjs',
      'mod_client-dntoopie.js',
      'mod_client-h1r7vgy7.cjs',
      'ui.cjs',
      'ui.js',
    ])
  })
})
