import { describe, expect, it } from 'vitest'
import {
  assertFilesContent,
  getFileContents,
  createJob,
} from '../../testing-utils'

describe('integration esm-shims', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with ESM shims', async () => {
    await assertFilesContent(distDir, {
      'filename.mjs': /fileURLToPath\(import\.meta\.url\)/,
      'dirname.mjs': /dirname\(__filename(?:\$\d+)?\)/,
      'custom-require.mjs': (code) => !code.includes('createRequire'),
      'require.js': /require\(/,
      'filename.js': /__filename/,
      'dirname.js': /__dirname/,
      'custom-require.js': (code) => !code.includes('createRequire'),
    })

    const contents = await getFileContents(distDir, ['require.mjs'])
    expect(contents['require.mjs']).not.toContain('createRequire')
    expect(contents['require.mjs']).toContain('function getRequireModule')
    expect(contents['require.mjs']).toContain('import.meta.url')
  })
})
