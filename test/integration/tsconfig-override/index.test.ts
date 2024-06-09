import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration tsconfig-override', () => {
  it('should use es5 output in build without override', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        assertFilesContent(dir, {
          ['./dist/index.js']: (content) => {
            return (
              content.includes('function A') && !content.includes('class A')
            )
          },
        })
      },
    )
  })
  it('should use es8 output in build', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        args: ['--tsconfig', 'tsconfig.build.json'],
      },
      async ({ dir }) => {
        assertFilesContent(dir, {
          ['./dist/index.js']: (content) => {
            return (
              content.includes('class A') && !content.includes('function A')
            )
          },
        })
      },
    )
  })
})
