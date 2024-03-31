import { join } from 'path'
import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration monorepo-composite', () => {
  it('should succeed the build', async () => {
    await createIntegrationTest(
      {
        directory: join(__dirname, 'packages', 'a'),
      },
      async ({ distDir }) => {
        await assertContainFiles(distDir, ['index.js', 'index.d.ts'])
      },
    )
  })
})
