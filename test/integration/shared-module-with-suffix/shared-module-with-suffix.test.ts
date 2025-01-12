import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration - shared-module-with-suffix', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should alias correctly for the shared module with special suffix', async () => {
    await assertFilesContent(distDir, {
      'client.mjs': `./_private/util.browser.mjs`,
    })
  })
})
