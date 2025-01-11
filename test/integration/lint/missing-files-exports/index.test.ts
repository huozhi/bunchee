import { createIntegrationTest } from '../../../testing-utils'

describe('integration - lint - missing-files-exports', () => {
  it('should warn on missing files', async () => {
    await createIntegrationTest(
      {
        args: ['lint'],
        directory: __dirname,
      },
      async ({ stderr }) => {
        expect(stderr).toContain('Missing files in package.json')
        expect(stderr).toContain('foo/index.js')
      },
    )
  })
})
