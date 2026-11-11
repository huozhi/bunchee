import { expect, test } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('client directives stay on their own modules and private modules stay internal', async () => {
  expect(job.code).toBe(0)
  expect(job.stderr).toBe('')
  const files = await getFileContents(distDir)
  expect(files['client/button.js']).toMatch(/^['"]use client['"]/)
  expect(files['client/index.js']).toMatch(/^['"]use client['"]/)
  expect(files['index.js']).not.toContain('use client')
  expect(files['_internal/value.js']).toBeDefined()
  expect(files['_internal/unreachable.js']).toBeUndefined()
  expect(job.stdout).not.toContain('_internal/value.js')
  expect(job.stdout).toMatch(/\+ \d+ internal modules?/)
})
