import { readFileSync } from 'fs'
import { createIntegrationTest, getFileNamesFromDirectory } from 'testing-utils'

describe('integration - mixed-directives', () => {
  it('should work with js only project', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = await getFileNamesFromDirectory(distDir)
        const fileContents = distFiles
          .map((file) => [file, readFileSync(`${distDir}/${file}`, 'utf-8')])
          .reduce((acc, pair) => {
            return {
              ...acc,
              [pair[0]]: pair[1],
            }
          }, {})

        expect(fileContents).toMatchSnapshot(``)
      },
    )
  })
})
