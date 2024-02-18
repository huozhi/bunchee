import { createIntegrationTest } from '../utils'
import { assertFilesContent } from '../../testing-utils'

describe('integration', () => {
  test(`edge-variable`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ fixturesDir }) => {
        assertFilesContent(fixturesDir, {
          './dist/index.js': /typeof EdgeRuntime/,
          './dist/index.edge.js': /typeof "edge-runtime"/,
        })
      },
    )
  })
})
