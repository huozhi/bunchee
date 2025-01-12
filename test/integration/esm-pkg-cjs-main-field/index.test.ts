import { createJob, assertContainFiles } from '../../testing-utils'

describe('integration esm-pkg-cjs-main-field', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with ESM package with CJS main field ', async () => {
    const distFiles = ['index.cjs', 'index.mjs']
    assertContainFiles(distDir, distFiles)
  })
})
