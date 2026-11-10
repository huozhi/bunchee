import { expect, test } from 'vitest'
import { createRequire } from 'module'
import path from 'path'
import { pathToFileURL } from 'url'
import { getFileContents, runCli } from '../../testing-utils'

test('shares one JS and one declaration graph across single-entry formats', async () => {
  const { code, stdout, stderr, distDir } = await runCli({
    directory: __dirname,
    options: { env: { PROFILE: '1' } },
  })
  expect(code).toBe(0)
  expect(stderr).toBe('')
  const events = stdout
    .split('\n')
    .filter((line) => line.startsWith('BUNCHEE_PROFILE '))
    .map((line) => JSON.parse(line.slice('BUNCHEE_PROFILE '.length)))
  const graphs = events.filter((event) => event.phase === 'rollup.graph')
  expect(graphs.map((event) => event.details.kind).sort()).toEqual([
    'dts',
    'js',
  ])
  expect(graphs.every((event) => event.details.inputs === 1)).toBe(true)

  const files = await getFileContents(distDir)
  expect(files['index.d.ts']).toContain('declare const answer: number')
  expect(files['index.d.cts']).toContain('declare const answer: number')
  const require = createRequire(import.meta.url)
  expect(require(path.join(distDir, 'index.cjs')).answer).toBe(42)
  expect(
    (await import(pathToFileURL(path.join(distDir, 'index.js')).href)).answer,
  ).toBe(42)
})
