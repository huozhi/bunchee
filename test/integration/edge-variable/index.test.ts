import { createJob, assertFilesContent } from '../../testing-utils'

describe('integration edge-variable', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work with edge export condition', async () => {
    await assertFilesContent(distDir, {
      'index.js': /typeof EdgeRuntime/,
      'index.edge.js': /const variable = \"string\"/, // typeof "edge-runtime"
    })
  })
})
