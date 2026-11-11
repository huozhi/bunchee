import { expect, test } from 'vitest'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
  runCli,
} from '../../testing-utils'

const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})

test('reachable modules mirror src, keep exact exports paths, and skip the rest', async () => {
  expect(job.code).toBe(0)
  expect(job.stderr).toBe('')
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
    '_internal/value.js',
    'bin/cli.js',
    'client/button.js',
    'client/index.js',
    'index.js',
    'utils/format.js',
  ])
  const files = await getFileContents(distDir)
  expect(files['index.js']).toContain("'./utils/format.js'")
  expect(files['bin/cli.js']).toContain("'../_internal/value.js'")
})

test('directives and shebangs stay on the files that declare them', async () => {
  const files = await getFileContents(distDir)
  expect(files['client/button.js']).toMatch(/^['"]use client['"]/)
  expect(files['client/index.js']).toMatch(/^['"]use client['"]/)
  expect(files['index.js']).not.toContain('use client')
  expect(files['bin/cli.js']).toMatch(/^#!\/usr\/bin\/env node/)
  for (const file of ['index.js', '_internal/value.js', 'utils/format.js'])
    expect(files[file]).not.toContain('#!')
})

test('the log lists public entries and summarizes internal modules', async () => {
  expect(job.stdout).not.toContain('_internal/value.js')
  expect(job.stdout).toMatch(/\+ \d+ internal modules?/)
  // Without a sideEffects field the build suggests one, as info.
  expect(job.stdout).toContain('sideEffects')
})

test('minification produces a sourcemap for each emitted module', async () => {
  const result = await runCli({
    directory: __dirname,
    args: ['--unbundle', '--minify'],
  })
  expect(result.code).toBe(0)
  const names = await getFileNamesFromDirectory(distDir)
  expect(names.filter((name) => !name.endsWith('.map'))).toHaveLength(6)
  for (const name of names.filter((name) => !name.endsWith('.map')))
    expect(names).toContain(`${name}.map`)
})
