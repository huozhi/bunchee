import { createIntegrationTest, existsFile } from '../utils'

describe('integration', () => {
  test(`js-only`, async () => {
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
