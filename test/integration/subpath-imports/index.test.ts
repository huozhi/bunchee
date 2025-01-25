import { describe, it } from 'vitest'
import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration shared-module', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should split shared module into one chunk layer', async () => {
    await assertFilesContent(distDir, {
      'index.js': `const dep = 'polyfill-dep'`,
    })
  })
})
