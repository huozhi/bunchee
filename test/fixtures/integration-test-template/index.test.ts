import { describe, it } from 'vitest'
import { createJob, assertContainFiles } from '../../testing-utils'

describe('integration - <name>', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    assertContainFiles(distDir, ['index.js'])
  })
})
