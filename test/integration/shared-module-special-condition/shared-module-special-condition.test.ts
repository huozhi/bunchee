import { createJob, getFileContents } from '../../testing-utils'

describe('integration - shared-module-special-condition', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    const contents = await getFileContents(distDir)
    const files = [
      'index.development.js',
      'index.production.js',
      'index.browser.js',
    ]
    files.forEach((file) => {
      expect(contents[file]).toContain('./_util.js')
      expect(contents[file]).not.toContain('./_util.ts')
    })
  })
})
