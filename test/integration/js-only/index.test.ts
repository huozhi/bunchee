import { createIntegrationTest, existsFile } from '../utils'

describe('integration js-only', () => {
  it('should work with js only project', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFile = `${distDir}/index.js`
        expect(await existsFile(distFile)).toBe(true)
      },
    )
  })
})
