import { createJob, assertFilesContent } from '../../testing-utils'

describe('integration dev-prod-convention', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with dev and prod optimize conditions', async () => {
    await assertFilesContent(distDir, {
      'index.development.js': /= "development"/,
      'index.development.mjs': /= "development"/,
      'index.production.js': /= "production"/,
      'index.production.mjs': /= "production"/,
      // Do not replace NODE_ENV by default
      'index.js': /= process.env.NODE_ENV/,
      'index.mjs': /= process.env.NODE_ENV/,
    })
  })
})
