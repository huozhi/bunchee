import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration basic-jsx', () => {
  it('should work with basic JSX format', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ distDir, stderr, stdout }) => {
        expect(stderr + stdout).not.toContain('(swc plugin)')
        assertContainFiles(distDir, ['index.js', 'index.mjs'])
      },
    )
  })
})
