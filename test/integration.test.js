const { execSync, fork } = require('child_process');
const fs = require('fs');
const { resolve, join } = require('path');

const integrationTestDir = resolve(__dirname, 'integration');

const getPath = (filepath) => join(integrationTestDir, filepath)

const testCases = [
  {
    name: 'ts-error',
    args: ['index.ts', '-o', './dist/index.js', '--cwd', getPath('ts-error')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
      ]
    }
  },
]

async function runBundle(dir, args) {
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
    const { name, args } = testCase
    const dir = getPath(name)
    test(`integration ${name}`, async () => {
      const { stdout, stderr } =  await runBundle(dir, args)
      expect(stdout).toMatch(/Could not load TypeScript compiler/)
    })
  }
}

runTests()
