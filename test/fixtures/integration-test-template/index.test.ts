import { createIntegrationTest, assertContainFiles } from '../../testing-utils'

describe('integration - <name>', () => {
  it('should work', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      ({ distDir }) => {
        assertContainFiles(distDir, ['index.js'])
      },
    )
  })
})
