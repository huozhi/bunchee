import { expect, test } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('only bin entries get a shebang and their exports paths remain exact', async () => {
  expect(job.code).toBe(0)
  const files = await getFileContents(distDir)
  expect(files['bin/cli.js']).toMatch(/^#!\/usr\/bin\/env node/)
  expect(files['bin/cli.js']).toContain("'../value.js'")
  expect(files['value.js']).not.toContain('#!')
  expect(files['index.js']).not.toContain('#!')
})
