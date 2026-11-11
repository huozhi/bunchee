import { afterEach, beforeEach, expect, test } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { runCli } from '../../testing-utils'
let dir: string
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bunchee-unbundle-errors-'))
  await mkdir(path.join(dir, 'src'))
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'unbundle-errors',
      type: 'module',
      exports: './dist/index.js',
    }),
  )
  await writeFile(path.join(dir, 'src/index.js'), 'export const value = 42')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

test.each([
  [['--watch'], 'BUNCHEE_UNBUNDLE_WATCH_UNSUPPORTED'],
  [['-o', 'dist/output.js'], 'BUNCHEE_UNBUNDLE_SINGLE_OUTPUT'],
] as const)('rejects incompatible options %s with %s', async (args, error) => {
  const result = await runCli({ directory: dir, args: ['--unbundle', ...args] })
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain(error)
})

test('rejects local modules outside the source root', async () => {
  await writeFile(path.join(dir, 'outside.js'), 'export const value = 1')
  await writeFile(
    path.join(dir, 'src/index.js'),
    "export { value } from '../outside.js'",
  )
  const result = await runCli({ directory: dir, args: ['--unbundle'] })
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain('BUNCHEE_UNBUNDLE_OUTSIDE_ROOT')
  expect(result.stderr).toContain('outside.js')
})

test('rejects collisions between internal module paths and explicit exports paths', async () => {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'unbundle-errors',
      type: 'module',
      exports: './dist/clash.js',
    }),
  )
  await writeFile(
    path.join(dir, 'src/index.js'),
    "export { value } from './clash.js'",
  )
  await writeFile(path.join(dir, 'src/clash.js'), 'export const value = 1')
  const result = await runCli({ directory: dir, args: ['--unbundle'] })
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain('BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT')
  expect(result.stderr).toContain('index.js')
  expect(result.stderr).toContain('clash.js')
})

test('rejects an exports directory that npm pack would discard', async () => {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'unbundle-errors',
      type: 'module',
      exports: './dist/node_modules/index.js',
    }),
  )
  const result = await runCli({ directory: dir, args: ['--unbundle'] })
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain('BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT')
  expect(result.stderr).toContain('node_modules')
})

test('the Node API exposes unbundle and preserves actionable error names', async () => {
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const { pathToFileURL } = await import('url')
  const api = path.resolve(
    __dirname,
    process.env.POST_BUILD ? '../../../dist/index.js' : '../../../src/index.ts',
  )
  const { stdout } = await promisify(execFile)(process.execPath, [
    '--import',
    'tsx',
    '--input-type=module',
    '-e',
    `
    import { bundle } from ${JSON.stringify(pathToFileURL(api).href)};
    await bundle('', { cwd: ${JSON.stringify(dir)}, unbundle: true, runtime: 'node' });
    try { await bundle('', { cwd: ${JSON.stringify(dir)}, unbundle: true, watch: true }) }
    catch (error) { console.log(error.name) }
  `,
  ])
  expect(stdout).toContain('BUNCHEE_UNBUNDLE_WATCH_UNSUPPORTED')
  const { readFile } = await import('fs/promises')
  expect(await readFile(path.join(dir, 'dist/index.js'), 'utf8')).toContain(
    '42',
  )
})

test('requires declared exports instead of inferring an entry output from main', async () => {
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({
      name: 'unbundle-errors',
      type: 'module',
      main: './dist/index.js',
    }),
  )
  const result = await runCli({ directory: dir, args: ['--unbundle'] })
  expect(result.code).not.toBe(0)
  expect(result.stderr).toContain('BUNCHEE_UNBUNDLE_NO_EXPORTS')
  expect(result.stderr).toContain(
    'requires package.json exports or bin entries',
  )
})

test('the Node API switches modes without leaking output or per-build registries', async () => {
  await writeFile(
    path.join(dir, 'src/index.js'),
    "export { value } from './helper.js'",
  )
  await writeFile(path.join(dir, 'src/helper.js'), 'export const value = 42')
  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const { pathToFileURL } = await import('url')
  const api = path.resolve(
    __dirname,
    process.env.POST_BUILD ? '../../../dist/index.js' : '../../../src/index.ts',
  )
  const { stdout } = await promisify(execFile)(process.execPath, [
    '--import',
    'tsx',
    '--input-type=module',
    '-e',
    `
    import { bundle } from ${JSON.stringify(pathToFileURL(api).href)};
    import { existsSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs';
    // Use one canonical spelling so macOS /var aliases cannot hide stale cleanup state.
    const cwd = realpathSync(${JSON.stringify(dir)});
    const found = [];
    for (const unbundle of [true, false, true]) {
      if (found.length === 2) {
        unlinkSync(cwd + '/src/helper.js');
        writeFileSync(cwd + '/src/helper.ts', 'export const value = 43');
        writeFileSync(cwd + '/src/index.js', "export { value } from './helper.ts'");
      }
      await bundle('', { cwd, unbundle, clean: true, dts: false, runtime: 'node' });
      found.push(existsSync(cwd + '/dist/helper.js'));
    }
    console.log(JSON.stringify(found));
  `,
  ])
  // The last line is the result; build notices may precede it.
  expect(stdout.trim().split('\n').pop()).toBe('[true,false,true]')
})
