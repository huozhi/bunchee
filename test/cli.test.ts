jest.setTimeout(10 * 60 * 1000)

import fs from 'fs'
import path from 'path'
import { fork, execSync } from 'child_process'

const resolveFromTest = (filepath: string) => path.resolve(__dirname, '../test', filepath)
const fixturesDir = resolveFromTest('fixtures')

const testCases: {
  name: string
  args: string[]
  dist?: string
  expected(f: string, { stderr, stdout }: { stderr: string; stdout: string }): [boolean, boolean][]
}[] = [
  {
    name: 'basic',
    args: [resolveFromTest('fixtures/hello.js'), '-o', resolveFromTest('dist/hello.bundle.js')],
    expected(distFile) {
      return [[fs.existsSync(distFile), true]]
    },
  },
  {
    name: 'format',
    args: [
      resolveFromTest('fixtures/hello.js'),
      '--cwd',
      fixturesDir,
      '-f',
      'cjs',
      '-o',
      resolveFromTest('dist/hello.cjs'),
    ],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('exports.'), true],
      ]
    },
  },
  {
    name: 'compress',
    args: [resolveFromTest('fixtures/hello.js'), '-m', '-o', resolveFromTest('dist/hello.bundle.min.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // original function name is compressed
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sayHello'), false],
      ]
    },
  },
  {
    name: 'with sourcemap',
    args: [resolveFromTest('fixtures/hello.js'), '--sourcemap', '-o', resolveFromTest('dist/hello.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        //# sourceMappingURL is set
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sourceMappingURL'), true],
        [fs.existsSync(distFile + '.map'), true],
      ]
    },
  },
  {
    name: 'minified with sourcemap',
    args: [resolveFromTest('fixtures/hello.js'), '-m', '--sourcemap', '-o', resolveFromTest('dist/hello.min.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        //# sourceMappingURL is set
        [fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sourceMappingURL'), true],
        [fs.existsSync(distFile + '.map'), true],
      ]
    },
  },
  {
    name: 'externals',
    args: [
      resolveFromTest('fixtures/with-externals.js'),
      '-e',
      'foo',
      '-o',
      resolveFromTest('dist/with-externals.bundle.js'),
    ],
    expected(distFile, { stdout, stderr }) {
      const output = stdout + stderr
      return [
        [fs.existsSync(distFile), true],
        [
          output.includes(
            `'bar' is imported by test/fixtures/with-externals.js, but could not be resolved – treating it as an external dependency`
          ),
          false,
        ],
        [
          output.includes(
            `'foo' is imported by test/fixtures/with-externals.js, but could not be resolved – treating it as an external dependency`
          ),
          false,
        ],
      ]
    },
  },
  {
    name: 'es2020-target',
    args: [resolveFromTest('fixtures/es2020.ts'), '--target', 'es2020', '-o', resolveFromTest('dist/es2020.js')],
    expected(distFile, { stdout, stderr }) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [
        [content.includes(`...globalThis`), true],
        [content.includes(`setTimeout?.apply?.bind`), true],
        [content.includes(`async function`), true],
        [content.includes(`class A`), true],
      ]
    },
  },
  {
    name: 'dts',
    // need working directory for tsconfig.json
    args: ['./base.ts', '--dts', '--cwd', fixturesDir, '-o', path.resolve(fixturesDir, './dist/base.js')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // same name with input file
        [fs.existsSync(distFile.replace('.js', '.d.ts')), true],
      ]
    },
  },
  {
    name: 'workspace',
    // --cwd without -o option
    dist: path.join(fixturesDir, './package/dist'),
    args: ['index.ts', '--cwd', path.join(fixturesDir, './package')],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // same name with input file
        [fs.existsSync(distFile.replace('.mjs', '.d.ts')), true],
      ]
    }
  },
]

for (const testCase of testCases) {
  const { name, args, expected, dist } = testCase
  test(`cli ${name} should work properly`, async () => {
    // Delete the of dist folder: folder of dist file (as last argument) or `dist` option
    const distDir = dist || path.dirname(args[args.length - 1])
    // TODO: specify working directory for each test
    execSync(`rm -rf ${distDir}`)
    console.log(`Command: rm -rf ${distDir}`)
    console.log(`Command: bunchee ${args.join(' ')}`)
    const ps = fork(`${__dirname + '/../node_modules/.bin/tsx'}`, [__dirname + '/../cli.ts'].concat(args), { stdio: 'pipe' })
    let stderr = ''
    let stdout = ''
    ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
    ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
    const code = await new Promise((resolve) => {
      ps.on('close', resolve)
    })
    stdout && console.log(stdout)
    stderr && console.error(stderr)
    const distFile = args[args.length - 1]
    for (const conditions of expected(distFile, { stdout, stderr })) {
      const [left, right] = conditions
      expect(left).toBe(right)
    }
    expect(fs.existsSync(distFile)).toBe(true)
    expect(code).toBe(0)
  })
}
