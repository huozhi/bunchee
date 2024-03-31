import {
  assertContainFiles,
  assertFilesContent,
  stripANSIColor,
} from '../../testing-utils'
import { createIntegrationTest } from '../utils'

describe('integration single-entry', () => {
  it('should warn on invalid exports as CJS', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout, stderr }) => {
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
      },
    )
  })
})
