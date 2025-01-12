import { assertFilesContent, createJob } from '../../testing-utils'

describe('integration - ts-import-json-exports-condition', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should output correct bundles and types import json with export condition', async () => {
    await assertFilesContent(distDir, {
      'index.js': '0.0.1',
      'index.d.ts': 'declare const version: string',
    })
  })
})
