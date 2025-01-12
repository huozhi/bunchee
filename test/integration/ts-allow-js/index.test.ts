import {
  assertContainFiles,
  assertFilesContent,
  createJob,
} from '../../testing-utils'

describe('integration - ts-allow-js', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets', async () => {
    const distFiles = ['index.js', 'index.d.ts']
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.d.ts': 'declare function _default(): string;',
    })
  })
})
