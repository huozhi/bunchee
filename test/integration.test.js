const { execSync, fork } = require('child_process');
const fs = require('fs');
const { resolve, join } = require('path');

const integrationTestDir = resolve(__dirname, 'integration');

const getPath = (filepath) => join(integrationTestDir, filepath)

const testCases = [
  {
    name: 'ts-error',
    args: ['index.ts', '-o', './dist/index.js'],
    expected(dir, stdout) {
      const distFile = join(dir, './dist/index.js')
      expect(fs.existsSync(distFile)).toBe(false)
      expect(stdout).toMatch(/Could not load TypeScript compiler/)
    }
  },
  {
    name: 'no-ts-require-for-js',
    args: ['index.js', '-o', './dist/index.js'],
    expected(dir) {
      const distFile = join(dir, './dist/index.js')
      expect(fs.existsSync(distFile)).toBe(true)
    }
  }
]

async function runBundle(dir, _args) {
  const args = _args.concat(['--cwd', dir])
  console.log(`Command: bunchee ${args.join(' ')}`)
  execSync(`rm -rf ${join(dir, 'dist')}`)
  const ps = fork(
    __dirname + '/../dist/cli.js',
    args,
    {stdio: 'pipe'}
  );
  let stderr = '', stdout = '';
  ps.stdout.on('data', chunk => stdout += chunk.toString());
  ps.stderr.on('data', chunk => stderr += chunk.toString());
  return new Promise((resolve) => {
    ps.on('close', (code) => {
      resolve({
        code,
        stdout,
        stderr,
      })
    });
  });
}

function runTests() {
  for (const testCase of testCases) {
    const { name, args, expected } = testCase
    const dir = getPath(name)
    test(`integration ${name}`, async () => {
      const { stdout, stderr } =  await runBundle(dir, args)
      if (process.env.DEBUG_TEST) {
        console.log(stdout)
        console.error(stderr)
      }

      expected(dir, stdout, stderr)
    })
  }
}

runTests()
