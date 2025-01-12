import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration pkg-exports-ts-rsc', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should generate proper assets for rsc condition with ts', async () => {
    await assertFilesContent(distDir, {
      './index.mjs': /const shared = true/,
      './react-server.mjs': /'react-server'/,
      './react-native.js': /'react-native'/,
      './index.d.ts': /declare const shared = true/,
      './api.mjs': `'./index.mjs'`,
      './api.react-server.mjs': (content) => {
        return (
          content.includes('api:react-server') &&
          content.includes('./index.mjs')
        )
      },
    })
  })
})
