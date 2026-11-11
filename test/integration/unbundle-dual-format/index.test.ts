import { expect, test } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { pathToFileURL } from 'url'
import { createJob, getFileContents } from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle'],
})
test('unbundle emits executable ESM and CJS files with format-specific relative imports', async () => {
  expect(job.code).toBe(0)
  const files = await getFileContents(distDir)
  expect(files['index.js']).toContain("'./utils/create.js'")
  expect(files['index.cjs']).toContain("'./utils/create.cjs'")
  const exec = promisify(execFile)
  const esm = await exec(process.execPath, [
    '--input-type=module',
    '-e',
    `import { create } from ${JSON.stringify(pathToFileURL(path.join(distDir, 'index.js')).href)}; console.log(create().value)`,
  ])
  const cjs = await exec(process.execPath, [
    '-e',
    `console.log(require(${JSON.stringify(path.join(distDir, 'index.cjs'))}).create().value)`,
  ])
  expect(esm.stdout.trim()).toBe('42')
  expect(cjs.stdout.trim()).toBe('42')
})

test('unbundle emits nested declarations, matching extensions, and declaration maps', async () => {
  expect(job.code).toBe(0)
  const files = await getFileContents(distDir)
  for (const [ext, jsExt] of [
    ['d.ts', 'js'],
    ['d.cts', 'cjs'],
  ]) {
    expect(files[`index.${ext}`]).toContain(`'./utils/create.${jsExt}'`)
    expect(files[`utils/create.${ext}`]).toMatch(
      new RegExp(`from ['\"](?:\\./types|\\.\\./index)\\.${jsExt}['\"]`),
    )
    expect(files[`utils/types.${ext}`]).toContain('interface Shared')
    expect(
      JSON.parse(files[`utils/create.${ext}.map`]).sources.length,
    ).toBeGreaterThan(0)
  }
})

test('implementation-only TypeScript modules also get individual declarations', async () => {
  const files = await getFileContents(distDir)
  expect(files['utils/compute.js']).toBeDefined()
  expect(files['utils/compute.d.ts']).toContain('compute')
  expect(files['utils/compute.d.cts']).toContain('compute')
})
