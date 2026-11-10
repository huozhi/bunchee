import { afterEach, beforeEach, expect, test } from 'vitest'
import { execFile } from 'child_process'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { promisify } from 'util'

const exec = promisify(execFile)
const cli = path.resolve(
  __dirname,
  process.env.POST_BUILD
    ? '../../../dist/bin/cli.js'
    : '../../../src/bin/index.ts',
)
let dir: string

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'bunchee-startup-'))
  await mkdir(path.join(dir, 'src'))
  await writeFile(
    path.join(dir, 'package.json'),
    JSON.stringify({ name: 'startup', private: true, type: 'module' }),
  )
  await writeFile(path.join(dir, 'src/index.js'), 'export const value = 42')
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

async function run(args: string[], blocked: string[]) {
  // Reject compiler imports rather than relying on noisy timing assertions.
  const loader = `data:text/javascript,${encodeURIComponent(`
    export function resolve(specifier, context, nextResolve) {
      if (${JSON.stringify(blocked)}.includes(specifier)) {
        throw new Error('Unexpected dependency: ' + specifier)
      }
      return nextResolve(specifier, context)
    }
  `)}`
  const guard = `data:text/javascript,${encodeURIComponent(`
    import { register } from 'node:module'
    register(${JSON.stringify(loader)})
  `)}`
  return exec(process.execPath, [
    '--import',
    'tsx',
    '--import',
    guard,
    cli,
    '--cwd',
    dir,
    ...args,
  ])
}

test.each(['--help', '--version', 'lint', 'prepare'])(
  '%s does not load the build toolchain',
  async (command) => {
    const { stdout } = await run(
      [command],
      ['rollup', '@swc/core', 'rollup-plugin-swc3', 'clean-css', 'piscina'],
    )
    if (command === '--help') expect(stdout).toContain('Options:')
    if (command === '--version') expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    if (command === 'prepare') {
      const pkg = JSON.parse(
        await readFile(path.join(dir, 'package.json'), 'utf8'),
      )
      expect(pkg.exports).toBeDefined()
    }
  },
)

test('plain JS builds do not load the CSS minifier or worker pool', async () => {
  await run(['src/index.js', '-o', 'dist/index.js'], ['clean-css', 'piscina'])
  expect(await readFile(path.join(dir, 'dist/index.js'), 'utf8')).toContain(
    '42',
  )
})
