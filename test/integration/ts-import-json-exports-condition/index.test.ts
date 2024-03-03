import { assertFilesContent, createIntegrationTest } from '../utils'

describe('integration - ts-import-json-exports-condition', () => {
  it('should output correct bundles and types import json with export condition', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        assertFilesContent(distDir, {
          'index.js': '0.0.1',
          'index.d.ts': 'declare const version: string',
        })
      },
    )
  })
})
