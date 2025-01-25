import { describe, it } from 'vitest'
import { createJob, assertFilesContent } from '../../testing-utils'

describe('integration dev-prod-special-convention', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with dev prod and special optimize conditions', async () => {
    await assertFilesContent(distDir, {
      'index.react-server.mjs': 'index.react-server',
      'index.development.js': /'index.default'/,
      'index.development.mjs': /'index.default'/,
      'index.production.js': /'index.default'/,
      'index.production.mjs': /'index.default'/,
      'index.js': /'index.default'/,
      'index.mjs': /'index.default'/,
    })
  })
})
