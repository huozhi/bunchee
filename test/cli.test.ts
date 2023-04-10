jest.setTimeout(10 * 60 * 1000)

import fs, { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { fork, execSync } from 'child_process'
import { stripANSIColor } from './testing-utils'

const resolveFromTest = (filepath: string) => path.resolve(__dirname, '../test', filepath)
const fixturesDir = resolveFromTest('fixtures')

async function removeDirectory(tempDirPath: string) {
  await fsp.rm(tempDirPath, { recursive: true, force: true })
}

async function createTempDir(): Promise<string> {
  const tempDir = os.tmpdir()
  const tempDirPrefix = 'bunchee-test'
  const tempDirPath = path.join(tempDir, tempDirPrefix)

  return await fsp.mkdtemp(tempDirPath)
}

const testCases: {
  name: string
  args: string[]
  env?: Record<string, string>
  dist?: (() => Promise<string>) | string
  expected(f: string, { stderr, stdout }: { stderr: string; stdout: string }): [boolean, boolean][]
}[] = [
  {
    name: 'basic',
    dist: createTempDir,
    args: [resolveFromTest('fixtures/hello.js'), '-o', 'dist/hello.bundle.js'],
    expected(distFile) {
      return [[fs.existsSync(distFile), true]]
    },
  },
  {
    name: 'format',
    dist: createTempDir,
    args: [
      resolveFromTest('fixtures/hello.js'),
      '--cwd',
      fixturesDir,
      '-f',
      'cjs',
      '-o',
      'dist/hello.cjs',
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
    dist: createTempDir,
    args: [resolveFromTest('fixtures/hello.js'), '-m', '-o', 'dist/hello.bundle.min.js'],
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
    dist: createTempDir,
    args: [resolveFromTest('fixtures/hello.js'), '--sourcemap', '-o', 'dist/hello.js'],
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
    dist: createTempDir,
    args: [resolveFromTest('fixtures/hello.js'), '-m', '--sourcemap', '-o', 'dist/hello.min.js'],
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
    dist: createTempDir,
    args: [
      resolveFromTest('fixtures/with-externals.js'),
      '--external',
      '@huozhi/testing-package',
      '-o',
      'dist/with-externals.bundle.js',
    ],
    expected(distFile) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [
        [content.includes('@@test_expected_string@@'), false],
        [content.includes('bar-package'), true],
      ]
    },
  },
  {
    name: 'no-externals',
    dist: createTempDir,
    args: [
      resolveFromTest('fixtures/with-externals.js'),
      '--no-external',
      '-o',
      'dist/with-externals.bundle.js',
    ],
    expected(distFile) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [
        [content.includes('@@test_expected_string@@'), true],
        [content.includes('bar-package'), true],
      ]
    },
  },
  {
    name: 'es2020-target',
    dist: createTempDir,
    args: [resolveFromTest('fixtures/es2020.ts'), '--cwd', fixturesDir, '--target', 'es2020', '-o', 'dist/es2020.js'],
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
    dist: createTempDir,
    // need working directory for tsconfig.json
    args: ['./base.ts', '--dts', '--cwd', fixturesDir, '-o', './dist/base.js'],
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
  // single entry with custom entry path
  {
    name: 'single-entry-js',
    dist: path.join(fixturesDir, './single-entry-js/dist'),
    args: ['src/index.js', '--cwd', path.join(fixturesDir, './single-entry-js')],
    expected(distFile, { stdout }) {
      return [
        [fs.existsSync(distFile), true],
        // specifying types in package.json for js entry file won't work
        [stripANSIColor(stdout).includes('pkg.types is ./dist/index.d.ts but the file does not exist.'), true]
      ]
    },
  },
  {
    name: 'env-var',
    dist: createTempDir,
    args: [path.join(fixturesDir, './env-var-consumer/index.js'), '--env', 'MY_TEST_ENV'],
    env: {
      'MY_TEST_ENV': 'my-test-value'
    },
    expected(distFile) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [
        [content.includes('my-test-value'), true],
      ]
    },
  }
]

describe('cli', () => {
  for (const testCase of testCases) {
    const { name, args, expected, dist, env } = testCase
    it(`cli ${name} should work properly`, async () => {
      // Delete the of dist folder: folder of dist file (as last argument) or `dist` option
      let distDir
      let distFile
      if (typeof dist === 'function') {
        distDir = await dist()
        distFile = path.join(distDir, 'index.js')
        args.push('-o', distFile)
      } else if (typeof dist === 'string') {
        distDir = dist
        distFile = args[args.length - 1]
      } else {
        distDir = path.dirname(args[args.length - 1])
        distFile = args[args.length - 1]
      }

      // TODO: specify working directory for each test
      execSync(`rm -rf ${distDir}`)
      if (process.env.TEST_DBEUG) {
        console.log(`Command: rm -rf ${distDir}`)
        console.log(`Command: bunchee ${args.join(' ')}`)
      }
      const ps = fork(
        `${__dirname + '/../node_modules/.bin/tsx'}`,
        [__dirname + '/../src/cli.ts'].concat(args),
        {
          stdio: 'pipe',
          env,
        }
      )
      let stderr = ''
      let stdout = ''
      ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
      ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
      const code = await new Promise((resolve) => {
        ps.on('close', resolve)
      })
      if (stdout) console.log(stdout)
      if (stderr) console.error(stderr)

      for (const conditions of expected(distFile, { stdout, stderr })) {
        const [left, right] = conditions
        expect(left).toBe(right)
      }
      expect(fs.existsSync(distFile)).toBe(true)
      expect(code).toBe(0)
      if (process.env.TEST_DBEUG) {
        console.log(`Clean up ${distDir}`)
      }
      await removeDirectory(distDir)
    })
  }
})

