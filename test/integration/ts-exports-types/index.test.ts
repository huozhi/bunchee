import { assertContainFiles, createJob } from '../../testing-utils'

describe('integration - ts-exports-types', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets', async () => {
    const distFiles = ['index.mjs', 'index.cjs', 'index.d.ts']
    await assertContainFiles(distDir, distFiles)
  })
})
