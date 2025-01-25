import { describe, expect, it } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'

describe('integration server-components', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for each exports', async () => {
    const jsFiles = await getFileNamesFromDirectory(distDir)

    expect(jsFiles).toEqual([
      'index.cjs',
      'index.js',
      'mod_actions-server-B2kXJwqw.cjs',
      'mod_actions-server-DSdgX-jM.js',
      'mod_client-client-BO96FYFA.js',
      'mod_client-client-DAeHkA4H.cjs',
      'ui.cjs',
      'ui.js',
    ])
  })
})
