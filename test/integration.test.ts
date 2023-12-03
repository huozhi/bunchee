import fs from 'fs/promises'
import fsSync from 'fs'
import { execSync, fork } from 'child_process'
import { resolve, join } from 'path'
import { stripANSIColor, existsFile, assertFilesContent } from './testing-utils'
import * as debug from './utils/debug'

jest.setTimeout(10 * 60 * 1000)

const integrationTestDir = resolve(__dirname, 'integration')

const getPath = (filepath: string) => join(integrationTestDir, filepath)

const testCases: {
  name: string
  args?: string[]
  expected(
    f: string,
    { stderr, stdout }: { stderr: string; stdout: string },
  ): void
}[] = [
  // TODO: test externals/sub-path-export
  {
    name: 'externals',
    args: ['index.js', '-o', './dist/index.js'],
    async expected(dir) {
      const distFile = join(dir, './dist/index.js')
      const content = await fs.readFile(distFile, { encoding: 'utf-8' })
      expect(content).toMatch(/['"]peer-dep['"]/)
      expect(content).toMatch(/['"]peer-dep-meta['"]/)
    },
  },
  {
    name: 'ts-error',
    args: ['index.ts', '-o', './dist/index.js'],
    async expected(dir, { stdout, stderr }) {
      const distFile = join(dir, './dist/index.js')
      expect(stderr).toMatch(/Could not load TypeScript compiler/)
      expect(await existsFile(distFile)).toBe(false)
    },
  },
  {
    name: 'no-ts-require-for-js',
    args: ['index.js', '-o', './dist/index.js'],
    async expected(dir) {
      const distFile = join(dir, './dist/index.js')
      expect(await existsFile(distFile)).toBe(true)
    },
  },
  {
    name: 'pkg-exports',
    args: ['index.js'],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.cjs'),
        join(dir, './dist/index.mjs'),
        join(dir, './dist/index.esm.js'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
    },
  },
  {
    name: 'pkg-exports-ts-rsc',
    async expected(dir) {
      assertFilesContent(dir, {
        './dist/index.mjs': /const shared = true/,
        './dist/react-server.mjs': /'react-server'/,
        './dist/react-native.js': /'react-native'/,
        './dist/index.d.ts': /declare const shared = true/,
      })
    },
  },
  {
    name: 'pkg-exports-default',
    args: ['index.js'],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.cjs'),
        join(dir, './dist/index.mjs'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
      const cjsFile = await fs.readFile(join(dir, './dist/index.cjs'), {
        encoding: 'utf-8',
      })
      expect(cjsFile).toContain(
        `function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }`,
      )
      expect(cjsFile).toContain(
        `Object.defineProperty(exports, '__esModule', { value: true });`,
      )
    },
  },
  {
    name: 'multi-entries',
    args: [],
    async expected(dir, { stdout }) {
      const contentsRegex = {
        './dist/index.js': /'index'/,
        './dist/shared/index.mjs': /'shared'/,
        './dist/shared/edge-light.mjs': /'shared.edge-light'/,
        './dist/server/edge.mjs': /'server.edge-light'/,
        './dist/server/react-server.mjs': /'server.react-server'/,
      }

      assertFilesContent(dir, contentsRegex)

      const log = `\
      ✓ Typed dist/server/index.d.ts       - 87 B
      ✓ Typed dist/server/index.d.mts      - 87 B
      ✓ Typed dist/lite.d.ts               - 70 B
      ✓ Typed dist/shared/index.d.mts      - 66 B
      ✓ Typed dist/client/index.d.cts      - 74 B
      ✓ Typed dist/client/index.d.mts      - 74 B
      ✓ Typed dist/client/index.d.ts       - 74 B
      ✓ Typed dist/index.d.ts              - 65 B
      ✓ Built dist/index.js                - 110 B
      ✓ Built dist/shared/edge-light.mjs   - 84 B
      ✓ Built dist/client/index.cjs        - 138 B
      ✓ Built dist/client/index.mjs        - 78 B
      ✓ Built dist/lite.js                 - 132 B
      ✓ Built dist/server/index.mjs        - 71 B
      ✓ Built dist/shared/index.mjs        - 53 B
      ✓ Built dist/server/react-server.mjs - 53 B
      ✓ Built dist/server/edge.mjs         - 51 B
      `

      const rawStdout = stripANSIColor(stdout)
      log.split('\n').forEach((line: string) => {
        expect(rawStdout).toContain(line.trim())
      })
    },
  },
  {
    name: 'ts-dual-package-type-cjs',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/index.mjs'),
        join(dir, './dist/index.d.ts'),
        join(dir, './dist/index.d.mts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
    },
  },
  {
    name: 'ts-dual-package-module',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/index.cjs'),
        join(dir, './dist/index.d.ts'),
        join(dir, './dist/index.d.cts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
    },
  },
  {
    name: 'ts-exports-types',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.mjs'),
        join(dir, './dist/index.cjs'),
        join(dir, './dist/index.d.mts'),
        join(dir, './dist/index.d.cts'),
        join(dir, './dist/index.d.ts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
    },
  },
  {
    name: 'single-entry',
    args: [],
    async expected(dir, { stdout }) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/index.d.ts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
      expect(await fs.readFile(distFiles[0], 'utf-8')).toContain(
        `Object.defineProperty(exports, '__esModule', { value: true });`,
      )
      expect(await fs.readFile(distFiles[1], 'utf-8')).toContain(
        'declare const _default: () => string;',
      )

      const log = `\
      ✓ Typed dist/index.d.ts -
      ✓ Built dist/index.js   -`

      const rawStdout = stripANSIColor(stdout)
      log.split('\n').forEach((line: string) => {
        expect(rawStdout).toContain(line.trim())
      })
    },
  },
  {
    name: 'ts-allow-js',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/index.js'),
        join(dir, './dist/index.d.ts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
      expect(await fs.readFile(distFiles[1], 'utf-8')).toContain(
        'declare function _default(): string;',
      )
    },
  },
  {
    name: 'ts-incremental',
    args: [],
    async expected(dir) {
      const distFiles = [
        './dist/index.js',
        './dist/index.d.ts',
      ]

      for (const f of distFiles) {
        expect(await existsFile(join(dir, f))).toBe(true)
      }
      expect(await fs.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
        'declare const _default: () => string;',
      )
      expect(await existsFile(join(dir, './dist/.tsbuildinfo'))).toBe(false)
    },
  },
  {
    name: 'publint',
    args: [],
    expected(dir, { stdout }) {
      const text = stripANSIColor(stdout)
      expect(text).toContain(
        'pkg.types is ./dist/missing.d.ts but the file does not exist.',
      )
      expect(text).toContain(
        'pkg.exports["."].types is ./dist/missing.d.ts but the file does not exist.',
      )
    },
  },
  {
    name: 'wildcard-exports',
    args: [],
    async expected(dir, { stdout, stderr }) {
      const contentsRegex = {
        './dist/index.js': /'index'/,
        './dist/layout/index.js': /'layout'/,
        './dist/server/edge.mjs': /'server.edge-light'/,
        './dist/server/react-server.mjs': /'server.react-server'/,
      }

      assertFilesContent(dir, contentsRegex)

      const log = `\
      ✓ Typed dist/lite.d.ts               - 70 B
      ✓ Typed dist/input.d.ts              - 65 B
      ✓ Typed dist/index.d.ts              - 65 B
      ✓ Typed dist/server/index.d.ts       - 87 B
      ✓ Typed dist/layout/index.d.ts       - 66 B
      ✓ Typed dist/button.d.ts             - 66 B
      ✓ Built dist/input.js                - 50 B
      ✓ Built dist/index.js                - 50 B
      ✓ Built dist/button.js               - 53 B
      ✓ Built dist/lite.js                 - 72 B
      ✓ Built dist/layout/index.js         - 51 B
      ✓ Built dist/server/react-server.mjs - 53 B
      ✓ Built dist/server/edge.mjs         - 51 B
      ✓ Built dist/server/index.mjs        - 71 B
      `

      const rawStdout = stripANSIColor(stdout)
      log.split('\n').forEach((line: string) => {
        expect(rawStdout).toContain(line.trim())
      })
      expect(stderr).toContain('is experimental')
    },
  },
  {
    name: 'no-entry',
    args: [],
    async expected(_dir, { stderr }) {
      const log =
        'The "src" directory does not contain any entry files. ' +
        'For proper usage, please refer to the following link: ' +
        'https://github.com/huozhi/bunchee?tab=readme-ov-file#usage'
      expect(stderr).toContain(log)
    },
  },
  {
    name: 'esm-pkg-cjs-main-field',
    args: [],
    async expected(_, { stderr }) {
      expect(stderr).toContain(
        'Cannot export main field with .cjs extension in ESM package, only .mjs and .js extensions are allowed',
      )
    },
  },
  {
    name: 'esm-shims',
    args: [],
    async expected(dir) {
      const shimsCode = [
        'const __filename = cjsUrl.fileURLToPath(import.meta.url)',
        'const __dirname = cjsPath.dirname(__filename)',
        'const require = cjsModule.createRequire(import.meta.url)',
      ]
      const esmOutput = await fs.readFile(join(dir, './dist/index.mjs'), 'utf-8')
      const cjsOutput = await fs.readFile(join(dir, './dist/index.cjs'), 'utf-8')
      expect(
        shimsCode.every((code) => esmOutput.includes(code)),
      ).toBe(true)
      expect(
        shimsCode.map((code) => cjsOutput.includes(code)),
      ).toEqual([false, false, false])
      // for import.meta.url, should use pathToFileURL + URL polyfill
      expect(cjsOutput).toContain('pathToFileURL')
      expect(cjsOutput).toContain('new URL')
      expect(cjsOutput).not.toContain('import.meta.url')
    },
  },
]

async function runBundle(
  dir: string,
  args_: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const assetPath = process.env.POST_BUILD
    ? '/../dist/cli.js'
    : '/../src/cli.ts'

  const args = (args_ || []).concat(['--cwd', dir])
  const ps = fork(
    `${require.resolve('tsx/cli')}`,
    [__dirname + assetPath].concat(args),
    { stdio: 'pipe' },
  )
  let stderr = '',
    stdout = ''
  ps.stdout?.on('data', (chunk: any) => (stdout += chunk.toString()))
  ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))
  return new Promise((resolve) => {
    ps.on('close', (code) => {
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
    const { name, args = [], expected } = testCase
    const dir = getPath(name)
    test(`integration ${name}`, async () => {
      debug.log(`Command: bunchee ${args.join(' ')}`)
      execSync(`rm -rf ${join(dir, 'dist')}`)
      const { stdout, stderr } = await runBundle(dir, args)
      stdout && debug.log(stdout)
      stderr && debug.error(stderr)

      await expected(dir, { stdout, stderr })
    })
  }
}

runTests()
