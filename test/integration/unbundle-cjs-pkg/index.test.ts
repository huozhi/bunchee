import { expect, test } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('a commonjs package uses .mjs and .d.mts for its ESM modules', async () => {
  expect(job.code).toBe(0)
  const files = await getFileContents(distDir)
  expect(files['index.mjs']).toContain("'./utils/create.mjs'")
  expect(files['index.js']).toContain("'./utils/create.js'")
  expect(files['index.d.mts']).toContain("'./utils/create.mjs'")
  expect(files['utils/create.d.mts']).toContain("'./types.mjs'")
  expect(files['utils/create.d.ts']).toContain("'./types.js'")
})
