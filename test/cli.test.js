const fs = require('fs');
const path = require('path');
const { fork, execSync } = require('child_process');

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
  {
    name: 'compress',
    args: [resolve('fixtures/hello.js'), '-m', '-o', resolve('dist/hello.bundle.min.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // original function name is compressed
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sayHello'), false],
      ]
    }
  },
  {
    name: 'no-sourcemap',
    args: [resolve('fixtures/hello.js'), '--no-sourcemap', '-o', resolve('dist/hello.nomap.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        //# sourceMappingURL is not set
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sourceMappingURL'), false],
        [fs.existsSync(distFile + '.map'), false],
      ]
    }
  },
  {
    name: 'externals',
    args: [resolve('fixtures/with-externals.js'), '-e', 'foo', '-o', resolve('dist/with-externals.bundle.js')],
    expected(distFile, { stdout, stderr }) {
      const output = stdout + stderr
      return [
        [fs.existsSync(distFile), true],
        [output.includes(
          `'bar' is imported by test/fixtures/with-externals.js, but could not be resolved – treating it as an external dependency`
        ), true],
        [output.includes(
          `'foo' is imported by test/fixtures/with-externals.js, but could not be resolved – treating it as an external dependency`
        ), false]
      ]
    }
  }
]

for (const testCase of testCases) {
  const {name, args, expected} = testCase;
  test(`cli ${name} should work properly`, async () => {
    // Delete dist folder (as last argument)
    const dist = args[args.length - 1]
    execSync(`rm -rf ${path.dirname(dist)}`)
    const ps = fork(
      __dirname + '/../dist/cli.js',
      args,
      {stdio: 'pipe'}
    );
    let stderr = '', stdout = '';
    ps.stdout.on('data', chunk => stdout += chunk.toString());
    ps.stderr.on('data', chunk => stderr += chunk.toString());
    const code = await new Promise((resolve) => {
      ps.on('close', resolve);
    });
    stdout && console.log(stdout);
    stderr && console.error(stderr);
    const distFile = args[args.length - 1];
    for (const conditions of expected(distFile, { stdout, stderr })) {
      const [left, right] = conditions;
      expect(left).toBe(right);
    }
    expect(fs.existsSync(distFile)).toBe(true);
    expect(code).toBe(0);
  });
}
