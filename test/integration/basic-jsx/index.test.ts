import { createIntegrationTest, assertContainFiles } from '../utils'

describe('integration', () => {
  test(`basic-jsx`, async () => {
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
