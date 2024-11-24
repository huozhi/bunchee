import { createIntegrationTest } from '../../utils'

describe('integration - lint - missing-files-main', () => {
  it('should warn on missing files', async () => {
    await createIntegrationTest(
      {
        args: ['lint'],
        directory: __dirname,
      },
      async ({ stderr }) => {
        expect(stderr).toContain('Missing files in package.json')
        expect(stderr).toContain('index.js')
      },
    )
  })
})
