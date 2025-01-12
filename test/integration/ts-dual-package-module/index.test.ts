import { createJob, assertContainFiles } from '../../testing-utils'

describe('integration ts-dual-package-module', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should ensure generated assets', async () => {
    const distFiles = ['index.js', 'index.cjs']
    assertContainFiles(distDir, distFiles)
  })
})
