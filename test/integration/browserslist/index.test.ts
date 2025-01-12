import { assertFilesContent, createJob } from '../../testing-utils'

describe('browserslist', () => {
  const { distDir } = createJob({ directory: __dirname })
  it('should work with basic JSX format', async () => {
    await assertFilesContent(distDir, {
      'index.js': `_class_private_field_loose_key`,
    })
  })
})
