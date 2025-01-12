import {
  assertFilesContent,
  createJob,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration shared-module', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should split all shared module into different chunks', async () => {
    const jsFiles = await getFileNamesFromDirectory(distDir)
    expect(jsFiles).toEqual([
      '_internal/util-a.cjs',
      '_internal/util-a.d.ts',
      '_internal/util-a.js',
      '_internal/util-b.cjs',
      '_internal/util-b.d.ts',
      '_internal/util-b.js',
      'export-a.js',
      'export-b.js',
      'export-c.js',
      'private/_nested/util-c.cjs',
      'private/_nested/util-c.d.ts',
      'private/_nested/util-c.js',
    ])

    await assertFilesContent(distDir, {
      'export-a.js': `'./_internal/util-a.js'`,
      'export-b.js': `'./_internal/util-b.js'`,
      'export-c.js': `'./private/_nested/util-c.js'`,
    })
  })
})
