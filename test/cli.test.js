const fs = require('fs');
const path = require('path');
const {fork} = require('child_process');

const resolve = filepath => path.resolve(__dirname, '../test', filepath)

const testCases = [
  {
    name: 'basic',
    args: [resolve('fixtures/hello.js'), '-o', resolve('dist/hello.bundle.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
      ]
    }
  },
]

for (const testCase of testCases) {
  const {name, args, expected} = testCase;
  it(`cli ${name} should work properly`, async () => {
    const ps = fork(
      __dirname + '/../dist/cli.js',
      args,
      {stdio: 'pipe'}
    );
    let stderr = '', stdout = '';
    ps.stdout.on('data', chunk => stdout += chunk.toString());
    ps.stderr.on('data', chunk => stderr += chunk.toString());
    await new Promise((resolve) => {
      ps.on('close', resolve)
    });
    stdout && console.log(stdout);
    stderr && console.error(stderr);
    const distFile = args[args.length - 1];
    for (const conditions of expected(distFile)) {
      const [left, right] = conditions;
      expect(left).toBe(right);
    }
    expect(fs.existsSync(distFile)).toBe(true);
    expect(stderr).toBe('');
  });
}

