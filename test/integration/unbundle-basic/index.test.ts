import { expect, test } from 'vitest'
import {
  createJob,
  getFileNamesFromDirectory,
  getFileContents,
} from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('single-entry unbundle mirrors reachable nested modules and rewrites imports', async () => {
  expect(job.code).toBe(0)
  expect(job.stdout).toContain('sideEffects')
  expect(job.stderr).not.toContain('sideEffects')
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
    'index.js',
    'utils/format.js',
  ])
  const files = await getFileContents(distDir)
  expect(files['index.js']).toContain("'./utils/format.js'")
  expect(files['utils/format.js']).toContain('value:')
})

test('unbundle minification produces sourcemaps for each emitted module', async () => {
  const { runCli } = await import('../../testing-utils')
  const result = await runCli({
    directory: __dirname,
    args: ['--unbundle', '--minify'],
  })
  expect(result.code).toBe(0)
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
    'index.js',
    'index.js.map',
    'utils/format.js',
    'utils/format.js.map',
  ])
})
