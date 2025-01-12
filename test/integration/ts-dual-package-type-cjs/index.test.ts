import { createJob, assertContainFiles } from '../../testing-utils'

describe('integration ts-dual-package-type-cjs', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should ensure generated assets', async () => {
    await assertContainFiles(distDir, ['index.js', 'index.mjs'])
  })
})
