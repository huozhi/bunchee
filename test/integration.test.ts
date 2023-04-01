jest.setTimeout(10 * 60 * 1000)

import fs from 'fs'
import { execSync, fork } from 'child_process'
import { resolve, join } from 'path'

function stripANSIColor(str: string) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')
}

const integrationTestDir = resolve(__dirname, 'integration')

const getPath = (filepath: string) => join(integrationTestDir, filepath)

const testCases: {
  name: string
  args: string[]
  expected(f: string, { stderr, stdout }: { stderr: string; stdout: string }): void
}[] = [
  // TODO: test externals/sub-path-export
  {
    name: 'externals',
    args: ['index.js', '-o', './dist/index.js'],
    expected(dir) {
      const distFile = join(dir, './dist/index.js')
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      expect(content).toMatch(/['"]peer-dep['"]/)
      expect(content).toMatch(/['"]peer-dep-meta['"]/)
    },
  },
  {
    name: 'ts-error',
    args: ['index.ts', '-o', './dist/index.js'],
    expected(dir, { stdout, stderr }) {
      const distFile = join(dir, './dist/index.js')
      expect(stderr).toMatch(/Could not load TypeScript compiler/)
      expect(fs.existsSync(distFile)).toBe(false)
    },
  },
  {
    name: 'no-ts-require-for-js',
    args: ['index.js', '-o', './dist/index.js'],
    expected(dir) {
      const distFile = join(dir, './dist/index.js')
      expect(fs.existsSync(distFile)).toBe(true)
    },
  },
  {
    name: 'pkg-exports',
    args: ['index.js'],
    expected(dir) {
      const distFiles = [join(dir, './dist/index.cjs'), join(dir, './dist/index.mjs'), join(dir, './dist/index.esm.js')]
      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)
    },
  },
  {
    name: 'pkg-exports-default',
    args: ['index.js'],
    expected(dir) {
      const distFiles = [join(dir, './dist/index.cjs'), join(dir, './dist/index.mjs')]
      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)
    },
  },
  {
    name: 'multi-entries',
    args: [],
    expected(dir) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/lite.js'),
        join(dir, './dist/client/index.cjs'),
        join(dir, './dist/client/index.mjs'),

        // types
        join(dir, './dist/client.d.ts'),
        join(dir, './dist/index.d.ts'),
        join(dir, './dist/lite.d.ts'),
      ]

      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)
    },
  },
  {
    name: 'single-entry',
    args: [],
    expected(dir) {
      const distFiles = [join(dir, './dist/index.js')]
      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)
    },
  },
  {
    name: 'publint',
    args: [],
    expected(dir, { stdout }) {
      const text = stripANSIColor(stdout)
      expect(text).toContain('pkg.types is ./dist/missing.d.ts but the file does not exist.')
      expect(text).toContain('pkg.exports["."].types is ./dist/missing.d.ts but the file does not exist.')
    }
  },
]

async function runBundle(
  dir: string,
  _args: string[]
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const args = _args.concat(['--cwd', dir])
  const ps = fork(`${__dirname + '/../node_modules/.bin/tsx'}`, [__dirname + '/../cli.ts'].concat(args), { stdio: 'pipe' })
  let stderr = '',
    stdout = ''
  ps.stdout?.on('data', (chunk: any) => (stdout += chunk.toString()))
  ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
  return new Promise((resolve) => {
    ps.on('close', (code) => {
      if (process.env.TEST_DEBUG) {
        stdout && console.log(stdout)
        stderr && console.error(stderr)
      }
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
    const { name, args, expected } = testCase
    const dir = getPath(name)
    test(`integration ${name}`, async () => {
      console.log(`Command: bunchee ${args.join(' ')}`)
      execSync(`rm -rf ${join(dir, 'dist')}`)
      const { stdout, stderr } = await runBundle(dir, args)
      if (process.env.DEBUG_TEST) {
        stdout && console.log(stdout)
        stderr && console.error(stderr)
      }

      expected(dir, { stdout, stderr })
    })
  }
}

runTests()
