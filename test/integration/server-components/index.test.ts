import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration server-components', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for each exports', async () => {
    const jsFiles = await getFileNamesFromDirectory(distDir)

    expect(jsFiles).toEqual([
      'cc-BU0zEyYq.js',
      'cc-DF6UvQmH.cjs',
      'index.cjs',
      'index.js',
      'mod_actions-12x-B8bHfyua.cjs',
      'mod_actions-12x-MaoLVK3i.js',
      'mod_client-12s-BO96FYFA.js',
      'mod_client-12s-DAeHkA4H.cjs',
      'ui.cjs',
      'ui.js',
    ])
  })
})
