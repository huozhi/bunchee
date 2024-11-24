import { createIntegrationTest } from '../../utils'

describe('integration - lint - missing-files', () => {
  it('should warn on missing files', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ stderr }) => {
        expect(stderr).toContain('Missing files in package.json')
        expect(stderr).toContain('foo/index.js')
      },
    )
  })
})
