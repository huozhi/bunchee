const { execSync, fork } = require('child_process')
const fs = require('fs')
const { resolve, join } = require('path')

const integrationTestDir = resolve(__dirname, 'integration')

const getPath = (filepath) => join(integrationTestDir, filepath)

const testCases = [
  // TODO: test externals/sub-path-export
  {
    name: 'externals',
    args: ['index.js', '-o', './dist/index.js'],
    expected(dir, stdout) {
      const distFile = join(dir, './dist/index.js')
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      expect(content).toMatch(/['"]peer-dep['"]/)
      expect(content).toMatch(/['"]peer-dep-meta['"]/)
    },
  },
  {
    name: 'ts-error',
    args: ['index.ts', '-o', './dist/index.js'],
    expected(dir, stdout) {
      const distFile = join(dir, './dist/index.js')
      expect(fs.existsSync(distFile)).toBe(false)
      expect(stdout).toMatch(/Could not load TypeScript compiler/)
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
    expected(dir, stdout, stderr) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/lite.js'),
        join(dir, './dist/client/index.cjs'),
        join(dir, './dist/client/index.mjs'),
      ]

      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)

      // non exported paths shouldn't be compiled from source file
      expect(fs.existsSync(join(dir, './dist/non-entry.js'))).toBe(false)
    },
  },
  {
    name: 'single-entry',
    args: [],
    expected(dir, stdout, stderr) {
      const distFiles = [join(dir, './dist/index.js')]
      expect(distFiles.every((f) => fs.existsSync(f))).toBe(true)
    },
  },
]

async function runBundle(dir, _args) {
  const args = _args.concat(['--cwd', dir])
  const ps = fork(__dirname + '/../dist/cli.js', args, { stdio: 'pipe' })
  let stderr = '',
    stdout = ''
  ps.stdout.on('data', (chunk) => (stdout += chunk.toString()))
  ps.stderr.on('data', (chunk) => (stderr += chunk.toString()))
  return new Promise((resolve) => {
    ps.on('close', (code) => {
      if (process.env.TEST_DEBUG) {
        console.log(stdout)
        console.error(stderr)
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
        console.log(stdout)
        console.error(stderr)
      }

      expected(dir, stdout, stderr)
    })
  }
}

runTests()
