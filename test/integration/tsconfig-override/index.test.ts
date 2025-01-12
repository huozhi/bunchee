import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration - tsconfig-override - default', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })

  it('should use es5 output in build without override', async () => {
    await assertFilesContent(distDir, {
      ['index.js']: (content) => {
        return content.includes('function A') && !content.includes('class A')
      },
    })
  })
})

describe('integration - tsconfig-override - customized', () => {
  const { distDir } = createJob({
    directory: __dirname,
    args: ['--tsconfig', 'tsconfig.build.json'],
  })

  it('should use es8 output in build', async () => {
    await assertFilesContent(distDir, {
      ['index.js']: (content) => {
        return content.includes('class A') && !content.includes('function A')
      },
    })
  })
})
