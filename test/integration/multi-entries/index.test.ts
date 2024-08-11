import {
  assertFilesContent,
  createIntegrationTest,
  getChunkFileNamesFromLog,
  stripANSIColor,
} from '../utils'

describe('integration multi-entries', () => {
  it('should contain files', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir, stdout }) => {
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

        const log = `\
        dist/index.js
        dist/index.d.ts
        dist/lite.js
        dist/client/index.mjs
        dist/client/index.cjs
        dist/client/index.d.ts
        dist/server/index.mjs
        dist/server/index.d.ts
        dist/server/edge.mjs
        dist/server/react-server.mjs
        dist/shared/index.mjs
        dist/shared/index.cjs
        dist/shared/index.d.ts
        dist/shared/edge-light.mjs
        `

        const rawStdout = stripANSIColor(stdout)
        getChunkFileNamesFromLog(log).forEach((chunk: string) => {
          expect(rawStdout).toContain(chunk)
        })
      },
    )
  })
})
