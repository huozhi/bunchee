import {
  createJob,
  assertContainFiles,
  getFileContents,
} from '../../testing-utils'

describe('integration - shared-module-special-condition', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work', async () => {
    const contents = await getFileContents(distDir)
    expect(contents['index.development.js']).toContain('./_util.js')
    expect(contents['index.development.js']).not.toContain('./_util.ts')
  })
})
