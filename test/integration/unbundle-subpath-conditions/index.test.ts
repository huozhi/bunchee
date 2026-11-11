import { expect, test } from 'vitest'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'

const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})

test('a condition graph made only of a subpath entry mirrors the package source root', async () => {
  expect(job.code).toBe(0)
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
    'client/index.d.ts',
    'client/index.js',
    'client/index.react-server.d.ts',
    'client/index.react-server.js',
    'index.d.ts',
    'index.js',
    'shared/value.d.ts',
    'shared/value.js',
    'shared/value.react-server.d.ts',
    'shared/value.react-server.js',
  ])
  const files = await getFileContents(distDir)
  expect(files['client/index.react-server.js']).toContain(
    "'../shared/value.react-server.js'",
  )
  expect(files['client/index.js']).toContain("'../shared/value.js'")
})
