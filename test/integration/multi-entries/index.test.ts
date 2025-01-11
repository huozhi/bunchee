import {
  assertFilesContent,
  createJob,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration - multi-entries', () => {
  const { dir, distDir, job } = createJob({ directory: __dirname })
  it('should contain files', async () => {
    const contentsRegex = {
      './dist/index.js': /'index'/,
      './dist/shared/index.mjs': /'shared'/,
      './dist/shared/edge-light.mjs': /'shared.edge-light'/,
      './dist/server/edge.mjs': /'server.edge-light'/,
      './dist/server/react-server.mjs': /'server.react-server'/,
      // types
      './dist/server/index.d.ts': `export { Client } from '../client/index.js';\nexport { Shared } from '../shared/index.js';`,
      './dist/client/index.d.ts': `export { Shared } from '../shared/index.js'`,
    }

    await assertFilesContent(dir, contentsRegex)

    const files = await getFileNamesFromDirectory(distDir)

    expect(files).toMatchInlineSnapshot(`
      [
        "client/index.cjs",
        "client/index.d.ts",
        "client/index.mjs",
        "index.d.ts",
        "index.js",
        "lite.js",
        "server/edge.mjs",
        "server/index.d.ts",
        "server/index.mjs",
        "server/react-server.mjs",
        "shared/edge-light.mjs",
        "shared/index.cjs",
        "shared/index.d.ts",
        "shared/index.mjs",
      ]
    `)
  })
})
