import fsp from 'fs/promises'
import { execSync, fork } from 'child_process'
import path, { resolve, join } from 'path'
import { existsFile, assertContainFiles } from './testing-utils'
import * as debug from './utils/debug'

const integrationTestDir = resolve(__dirname, 'integration')
const getPath = (filepath: string) => join(integrationTestDir, filepath)

const testCases: {
  name: string
  dir?: string
  skip?: boolean
  args?: string[]
  before?(dir: string): Promise<void> | void
  expected(
    f: string,
    { stderr, stdout }: { stderr: string; stdout: string },
  ): Promise<void> | void
}[] = [
  {
    name: 'ts-error',
    async expected(dir, { stdout, stderr }) {
      const distFile = join(dir, './dist/index.js')
      expect(stderr).toMatch(/Could not load TypeScript compiler/)
      expect(await existsFile(distFile)).toBe(false)
    },
  },
  {
    name: 'ts-dual-package-module',
    args: [],
    async expected(dir) {
      const distFiles = ['./dist/index.js', './dist/index.cjs']
      assertContainFiles(dir, distFiles)
    },
  },
  {
    name: 'ts-exports-types',
    args: [],
    async expected(dir) {
      const distFiles = [
        './dist/index.mjs',
        './dist/index.cjs',
        './dist/index.d.ts',
      ]
      assertContainFiles(dir, distFiles)
    },
  },
  {
    name: 'ts-allow-js',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/index.d.ts'),
      ]
      await assertContainFiles(dir, distFiles)
      expect(await fsp.readFile(distFiles[1], 'utf-8')).toContain(
        'declare function _default(): string;',
      )
    },
  },
  {
    name: 'ts-incremental',
    args: [],
    async expected(dir) {
      // TODO: disable incremental and avoid erroring
      const distFiles = ['./dist/index.js', './dist/index.d.ts']

      await assertContainFiles(dir, distFiles)
      expect(await fsp.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
        'declare const _default: () => string;',
      )
      expect(await existsFile(join(dir, './dist/.tsbuildinfo'))).toBe(false)
    },
  },
  {
    name: 'ts-incremental-with-buildinfofile',
    args: [],
    async expected(dir) {
      // TODO: disable incremental and avoid erroring
      const distFiles = ['./dist/index.js', './dist/index.d.ts']
      await assertContainFiles(dir, distFiles)

      expect(await fsp.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
        'declare const _default: () => string;',
      )
      expect(await existsFile(join(dir, './dist/.tsbuildinfo'))).toBe(false)
    },
  },
  {
    name: 'ts-no-emit',
    args: [],
    async expected(dir) {
      // should still emit declaration files
      const distFiles = ['./dist/index.js', './dist/index.d.ts']

      await assertContainFiles(dir, distFiles)
      expect(await fsp.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
        'declare const _default: () => string;',
      )
      expect(await existsFile(join(dir, './dist/.tsbuildinfo'))).toBe(false)
    },
  },
  {
    name: 'raw-data',
    args: [],
    async expected(dir) {
      const distFile = join(dir, './dist/index.js')
      expect(await existsFile(distFile)).toBe(true)
      expect(await fsp.readFile(distFile, 'utf-8')).toContain(`"thisismydata"`)
    },
  },
  {
    name: 'no-clean',
    args: ['--no-clean'],
    async before(dir) {
      execSync(`rm -rf ${join(dir, 'dist')}`)
      await fsp.mkdir(join(dir, 'dist'))
      await fsp.writeFile(join(dir, './dist/no-clean.json'), '{}')
    },
    async expected(dir) {
      const distFiles = [join(dir, './dist/no-clean.json')]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
    },
  },
  {
    name: 'no-clean',
    args: [],
    async before(dir) {
      execSync(`rm -rf ${join(dir, 'dist')}`)
      await fsp.mkdir(join(dir, 'dist'))
      await fsp.writeFile(join(dir, './dist/no-clean.json'), '{}')
    },
    async expected(dir) {
      expect(await existsFile(join(dir, './dist/no-clean.json'))).toBe(false)
      expect(await existsFile(join(dir, './dist/index.js'))).toBe(true)
    },
  },
  {
    name: 'ts-composite',
    dir: 'monorepo-composite/packages/a',
    async expected(dir) {
      expect(await existsFile(join(dir, './dist/index.js'))).toBe(true)
      expect(await existsFile(join(dir, './dist/index.d.ts'))).toBe(true)
    },
  },
  {
    name: 'ts-composite-without-incremental',
    dir: 'monorepo-composite-no-incremental/packages/a',
    async expected(dir) {
      expect(await existsFile(join(dir, './dist/index.js'))).toBe(true)
      expect(await existsFile(join(dir, './dist/index.d.ts'))).toBe(true)
    },
  },
]

async function runBundle(
  dir: string,
  args_: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const assetPath = process.env.POST_BUILD
    ? '../dist/bin/cli.js'
    : '../src/bin/index.ts'

  const args = (args_ || []).concat(['--cwd', dir])

  const ps = fork(path.resolve(__dirname, assetPath), args, {
    execArgv: ['-r', '@swc-node/register'],
    stdio: 'pipe',
    env: { SWC_NODE_IGNORE_DYNAMIC: 'true', ...process.env },
  })
  let stderr = '',
    stdout = ''
  ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
  ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
  return new Promise((resolve) => {
    ps.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
      })
    })
  })
}

function runTests() {
  for (const testCase of testCases) {
    const { name, args = [], expected, before, skip } = testCase
    const dir = getPath(testCase.dir ?? name)
    if (skip) {
      return
    }
    test(`integration ${name}`, async () => {
      debug.log(`Command: bunchee ${args.join(' ')}`)
      if (before) {
        await before(dir)
      }
      const { stdout, stderr } = await runBundle(dir, args)

      stdout && debug.log(stdout)
      stderr && debug.error(stderr)

      await expected(dir, { stdout, stderr })
    })
  }
}

runTests()
