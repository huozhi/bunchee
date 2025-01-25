import { describe, it } from 'vitest'
import { createJob, assertFilesContent } from '../../testing-utils'

describe('integration dev-prod-convention-reexport', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with dev and prod optimize conditions', async () => {
    await assertFilesContent(distDir, {
      // index export
      'index.dev.js': /core.dev.js/,
      'index.dev.mjs': /core.dev.mjs/,
      'index.prod.js': /core.prod.js/,
      'index.prod.mjs': /core.prod.mjs/,
      'index.js': /core.js/,
      'index.mjs': /core.mjs/,
    })
  })
})
