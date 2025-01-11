import { assertContainFiles, stripANSIColor } from '../../testing-utils'
import { createIntegrationTest } from 'testing-utils'
import * as console from 'node:console'

describe('integration stage3-decorator', () => {
  it('should build success when enable decorator', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir, stdout, stderr }) => {
        console.log(distDir, stdout, stderr)
        const distFiles = ['index.js', 'index.d.ts']

        await assertContainFiles(distDir, distFiles)

        const log = `\
        dist/index.d.ts
        dist/index.js`

        const rawStdout = stripANSIColor(stdout)
        log.split('\n').forEach((line: string) => {
          expect(rawStdout).toContain(line.trim())
        })
      },
    )
  })
})
