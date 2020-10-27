const fs = require('fs');
const path = require('path');
const {fork} = require('child_process');

const resolveRelative = filepath => path.resolve(__dirname, '../test', filepath)

it('cli should work properly', async () => {
  const srcFile = resolveRelative('fixtures/hello.js');
  const distFile = resolveRelative('dist/hello.bundle.js');
  const ps = fork(
    __dirname + '/../dist/cli.js',
    [srcFile, '-o', distFile],
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
  expect(fs.existsSync(distFile)).toBe(true);
});

