import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration nested-exports', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with nested path in exports', async () => {
    await assertFilesContent(distDir, {
      'foo/bar.js': "'foo.bar'",
    })
  })
})
