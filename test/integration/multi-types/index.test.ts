import { describe, expect, it } from 'vitest'
import {
  createJob,
  assertFilesContent,
  getChunkFileNamesFromLog,
  stripANSIColor,
} from '../../testing-utils'

describe('integration multi-types', () => {
  const { distDir, job } = createJob({ directory: __dirname })

  it('should contain files', async () => {
    const { stdout } = job
    const contentsRegex = {
      'index.js': /'index'/,
      // types
      'index.d.ts': `declare const index`,
      'index.d.mts': `declare const index`,
      'index.d.cts': `declare const index`,
    }

    await assertFilesContent(distDir, contentsRegex)

    const log = `\
      dist/index.cjs
      dist/index.js
      dist/index.mjs
      dist/index.d.mts
      dist/index.d.cts
    `

    const rawStdout = stripANSIColor(stdout)
    getChunkFileNamesFromLog(log).forEach((chunk: string) => {
      expect(rawStdout).toContain(chunk)
    })
  })
})
