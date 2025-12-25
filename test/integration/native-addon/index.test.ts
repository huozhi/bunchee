import { describe, expect, it } from 'vitest'
import {
  createJob,
  assertContainFiles,
  getFileContents,
} from '../../testing-utils'

describe('integration - native-addon', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should copy .node binary to dist', async () => {
    assertContainFiles(distDir, ['index.js', 'mock-addon.node'])
  })

  it('should generate correct loader code', async () => {
    const contents = await getFileContents(distDir)
    // Verify the generated code uses createRequire to load the native addon
    expect(contents['index.js']).toContain('createRequire')
    // Verify the binary filename is referenced in the generated code
    expect(contents['index.js']).toContain('mock-addon.node')
  })

  it('should preserve binary content', async () => {
    const contents = await getFileContents(distDir)
    // Verify the mock binary was copied with its content preserved
    expect(contents['mock-addon.node'].trim()).toBe(
      'MOCK_NATIVE_ADDON_BINARY_DATA_FOR_TESTING',
    )
  })
})
