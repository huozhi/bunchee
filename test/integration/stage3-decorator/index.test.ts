import { assertContainFiles, stripANSIColor } from '../../testing-utils'
import { createJob } from '../../testing-utils'

describe('integration stage3-decorator', () => {
  const { distDir, job } = createJob({ directory: __dirname })

  it('should build success when enable decorator', async () => {
    const { stdout } = job
    const distFiles = ['index.js', 'index.d.ts']

    await assertContainFiles(distDir, distFiles)

    const log = `\
    dist/index.d.ts
    dist/index.js`

    const rawStdout = stripANSIColor(stdout)
    log.split('\n').forEach((line: string) => {
      expect(rawStdout).toContain(line.trim())
    })
  })
})
