import { describe, it } from 'vitest'
import { join } from 'path'
import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration monorepo-composite-no-incremental', () => {
  const { distDir } = createJob({ directory: join(__dirname, 'packages', 'a') })
  it('should succeed the build', async () => {
    await assertContainFiles(distDir, ['index.js', 'index.d.ts'])
  })
})
