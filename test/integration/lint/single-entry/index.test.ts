import { describe, expect, it } from 'vitest'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
  stripANSIColor,
} from '../../../testing-utils'

describe('integration - single-entry', () => {
  const { job, distDir } = createJob({
    directory: __dirname,
  })
  it('should warn on invalid exports as CJS', async () => {
    const { stdout, stderr } = job
    const distFiles = ['index.js', 'index.d.ts']

    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.js': `Object.defineProperty(exports, '__esModule', { value: true });`,
      'index.d.ts': 'declare const _default: () => string;',
    })

    const log = `\
    dist/index.d.ts
    dist/index.js`

    expect(stderr).not.toContain('Cannot export `exports` field with')

    const rawStdout = stripANSIColor(stdout)
    log.split('\n').forEach((line: string) => {
      expect(rawStdout).toContain(line.trim())
    })
  })
})
