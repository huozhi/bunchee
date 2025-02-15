import { describe, it } from 'vitest'
import { assertFilesContent, createJob } from '../../testing-utils'

// TODO: this is not available as browser cannot be the fallback condition
// Until later we can use chunk split to create shared entry then it will be easier.
describe.skip('integration - shared-module-with-suffix', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should alias correctly for the shared module with special suffix', async () => {
    await assertFilesContent(distDir, {
      'client.mjs': `./_private/util.browser.mjs`,
    })
  })
})
