import fs, { promises as fsp } from 'fs'
import path from 'path'
import os from 'os'
import { execSync, fork } from 'child_process'
import { stripANSIColor } from './testing-utils'
import * as debug from './utils/debug'

jest.setTimeout(10 * 60 * 1000)

const fixturesDir = path.join(__dirname, 'fixtures/cli')
const resolveFromTest = (filepath: string) => path.join(fixturesDir, filepath)

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
  distFile?: string
  env?: Record<string, string>
  dist?: (() => Promise<string>) | string
  timeoutClose?: number
  expectedCode?: number
  expected(
    f: string,
    { stderr, stdout }: { stderr: string; stdout: string },
  ): [boolean | string, boolean | string][]
}[] = [
  {
    name: 'basic',
    dist: createTempDir,
    args: [resolveFromTest('hello.js')],
    distFile: 'dist/hello.bundle.js',
    expected(distFile) {
      return [[fs.existsSync(distFile), true]]
    },
  },
  {
    name: 'format',
    dist: createTempDir,
    args: [resolveFromTest('hello.js'), '-f', 'cjs'],
    distFile: 'dist/hello.cjs',
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        [
          fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('exports.'),
          true,
        ],
      ]
    },
  },
  {
    name: 'compress',
    dist: createTempDir,
    distFile: 'dist/hello.bundle.min.js',
    args: [resolveFromTest('hello.js'), '-m'],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // original function name is compressed
        [
          fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sayHello'),
          false,
        ],
      ]
    },
  },
  {
    name: 'with sourcemap',
    dist: createTempDir,
    args: [resolveFromTest('hello.js'), '--sourcemap'],
    distFile: 'dist/hello.js',
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        //# sourceMappingURL is set
        [
          fs
            .readFileSync(distFile, { encoding: 'utf-8' })
            .includes('sourceMappingURL'),
          true,
        ],
        [fs.existsSync(distFile + '.map'), true],
      ]
    },
  },
  {
    name: 'minified with sourcemap',
    dist: createTempDir,
    distFile: 'dist/hello.min.js',
    args: [resolveFromTest('hello.js'), '-m', '--sourcemap'],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        //# sourceMappingURL is set
        [
          fs
            .readFileSync(distFile, { encoding: 'utf-8' })
            .includes('sourceMappingURL'),
          true,
        ],
        [fs.existsSync(distFile + '.map'), true],
      ]
    },
  },
  {
    name: 'externals',
    dist: createTempDir,
    distFile: 'dist/with-externals.bundle.js',
    args: [
      resolveFromTest('with-externals.js'),
      '--external',
      '@huozhi/testing-package',
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
    distFile: 'dist/with-externals.bundle.js',
    args: [resolveFromTest('with-externals.js'), '--no-external'],
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
    distFile: 'dist/es2020.js',
    args: [resolveFromTest('es2020.ts'), '--target', 'es2020'],
    expected(distFile) {
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
    distFile: 'dist/base.js',
    // need working directory for tsconfig.json
    args: ['./base.ts', '--dts', '--cwd', fixturesDir],
    expected(distFile) {
      const typeFile = distFile.replace('.js', '.d.ts')
      return [
        [path.basename(distFile), 'base.js'],
        [path.basename(typeFile), 'base.d.ts'],
        [fs.existsSync(distFile), true],
        // same name with input file
        [fs.existsSync(typeFile), true],
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
    },
  },
  // single entry with custom entry path
  {
    name: 'single-entry-js',
    dist: path.join(fixturesDir, './single-entry-js/dist'),
    args: [
      'src/index.js',
      '--cwd',
      path.join(fixturesDir, './single-entry-js'),
    ],
    expected(distFile) {
      return [
        [fs.existsSync(distFile), true],
        // specifying types in package.json for js entry file won't work
        // if there's no tsconfig.json and entry file is js
        [fs.existsSync(distFile.replace('.js', '.d.ts')), true],
      ]
    },
  },
  {
    name: 'env-var',
    dist: createTempDir,
    args: [
      path.join(fixturesDir, './env-var-consumer/index.js'),
      '--env',
      'MY_TEST_ENV',
    ],
    env: {
      MY_TEST_ENV: 'my-test-value',
    },
    expected(distFile) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [[content.includes('my-test-value'), true]]
    },
  },
  {
    name: 'no-entry',
    dist: path.join(fixturesDir, './no-entry/dist'),
    args: ['--cwd', path.join(fixturesDir, './no-entry')],
    expected(distFile, { stderr }) {
      return [
        [
          stderr.includes(
            'The "src" directory does not contain any entry files.',
          ),
          true,
        ],
      ]
    },
  },
  {
    name: 'cjs-relative-imports',
    dist: createTempDir,
    args: [
      '--cwd',
      path.join(fixturesDir, './cjs-relative-imports'),
      '-o',
      './dist/index.js',
      './index.js',
    ],
    expected(distFile) {
      const content = fs.readFileSync(distFile, { encoding: 'utf-8' })
      return [
        [content.includes('dot-js-dep'), true],
        [content.includes('dot-cjs-dep'), true],
      ]
    },
  },
  {
    name: 'output-in-watch',
    dist: createTempDir,
    timeoutClose: 4000,
    expectedCode: 143, // finish watch mode by `ps.kill('SIGTERM')`, and it will send 143 code
    args: [resolveFromTest('hello.js'), '-w'],
    expected(_, { stdout }) {
      const watchOutputRegex = /Build in \d+(.\d{2})ms/
      return [
        [stdout.includes('Watching assets in'), true],
        [watchOutputRegex.test(stdout), true],
        [stdout.includes('Exports'), false],
      ]
    },
  },
]

describe('cli', () => {
  for (const testCase of testCases) {
    const {
      name,
      args,
      expected,
      dist,
      distFile: _distFile,
      env,
      timeoutClose,
      expectedCode,
    } = testCase
    it(`cli ${name} should work properly`, async (done) => {
      // Delete the of dist folder: folder of dist file (as last argument) or `dist` option
      let distDir
      let distFile
      if (typeof dist === 'function') {
        distDir = await dist()
        distFile = path.join(distDir, _distFile || 'index.js')
        args.push('-o', distFile)
        if (args.indexOf('--cwd') === -1) {
          args.push('--cwd', path.dirname(args[0]))
        }
      } else if (typeof dist === 'string') {
        distDir = dist
        distFile = args[args.length - 1]
      } else {
        distDir = path.dirname(args[args.length - 1])
        distFile = args[args.length - 1]
      }

      execSync(`rm -rf ${distDir}`)
      debug.log(`Command: rm -rf ${distDir}`)
      debug.log(`Command: bunchee ${args.join(' ')}`)

      const ps = fork(
        `${require.resolve('tsx/cli')}`,
        [__dirname + '/../src/bin/index.ts'].concat(args),
        {
          stdio: 'pipe',
          env,
        },
      )
      let stderr = ''
      let stdout = ''
      ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
      ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
      if (typeof timeoutClose === 'number') {
        setTimeout(() => {
          ps.kill('SIGTERM')
        }, timeoutClose)
      }
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
      expect(code).toBe(expectedCode ?? 0)
      debug.log(`Clean up ${distDir}`)

      await removeDirectory(distDir)
    })
  }
})
