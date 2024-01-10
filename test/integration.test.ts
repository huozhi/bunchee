import fsp from 'fs/promises'
import { execSync, fork } from 'child_process'
import { resolve, join } from 'path'
import {
  stripANSIColor,
  existsFile,
  assertFilesContent,
  getChunkFileNamesFromLog,
  assertContainFiles,
  deleteFile,
} from './testing-utils'
import * as debug from './utils/debug'

jest.setTimeout(10 * 60 * 1000)

const integrationTestDir = resolve(__dirname, 'integration')
const getPath = (filepath: string) => join(integrationTestDir, filepath)

const testCases: {
  name: string
  args?: string[]
  before?(dir: string): Promise<void> | void
  expected(
    f: string,
    { stderr, stdout }: { stderr: string; stdout: string },
  ): Promise<void> | void
}[] = [
  {
    name: 'externals',
    args: ['index.js', '-o', './dist/index.js'],
    async expected(dir) {
      const distFile = join(dir, './dist/index.js')
      const content = await fsp.readFile(distFile, { encoding: 'utf-8' })
      expect(content).toMatch(/['"]peer-dep['"]/)
      expect(content).toMatch(/['"]peer-dep-meta['"]/)
    },
  },
  {
    name: 'duplicate-entry',
    args: [],
    async expected(dir, { stdout }) {
      const distFiles = [
        'dist/index.js',
        'dist/index.mjs',
        'dist/index.d.ts',
        'dist/index.d.mts',
      ]
      assertContainFiles(dir, distFiles)
      for (const filename of distFiles) {
        // only contain file name once
        expect(stdout.split(filename).length).toBe(2)
      }
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
    name: 'entry-index-index',
    args: [],
    async expected(dir) {
      assertFilesContent(dir, {
        './dist/index.js': /'index'/,
        './dist/react-server.js': /\'react-server\'/,
      })
    },
  },
  {
    name: 'pkg-exports',
    args: ['index.js'],
    async expected(dir) {
      const distFiles = [
        'dist/index.cjs',
        'dist/index.mjs',
        'dist/index.esm.js',
      ]
      assertContainFiles(dir, distFiles)
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
        './dist/api.mjs': /\'pkg-export-ts-rsc\'/,
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
      const cjsFile = await fsp.readFile(join(dir, './dist/index.cjs'), {
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
      dist/shared/index.d.mts
      dist/index.d.ts
      dist/server/index.d.ts
      dist/server/index.d.mts
      dist/lite.d.ts
      dist/server/edge.d.mts
      dist/shared/edge-light.d.mts
      dist/server/react-server.d.mts
      dist/client/index.d.ts
      dist/client/index.d.cts
      dist/client/index.d.mts
      dist/shared/edge-light.mjs
      dist/shared/index.mjs
      dist/index.js
      dist/client/index.cjs
      dist/client/index.mjs
      dist/lite.js
      dist/server/react-server.mjs
      dist/server/edge.mjs
      dist/server/index.mjs
      `

      const rawStdout = stripANSIColor(stdout)
      getChunkFileNamesFromLog(log).forEach((chunk: string) => {
        expect(rawStdout).toContain(chunk)
      })
    },
  },
  {
    name: 'ts-dual-package-type-cjs',
    args: [],
    async expected(dir) {
      assertContainFiles(dir, [
        './dist/index.js',
        './dist/index.mjs',
        './dist/index.d.ts',
        './dist/index.d.mts',
      ])
    },
  },
  {
    name: 'ts-dual-package-module',
    args: [],
    async expected(dir) {
      const distFiles = [
        './dist/index.js',
        './dist/index.cjs',
        './dist/index.d.ts',
        './dist/index.d.cts',
      ]
      assertContainFiles(dir, distFiles)
    },
  },
  {
    name: 'ts-exports-types',
    args: [],
    async expected(dir) {
      const distFiles = [
        './dist/index.mjs',
        './dist/index.cjs',
        './dist/index.d.mts',
        './dist/index.d.cts',
        './dist/index.d.ts',
      ]
      assertContainFiles(dir, distFiles)
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
      expect(await fsp.readFile(distFiles[0], 'utf-8')).toContain(
        `Object.defineProperty(exports, '__esModule', { value: true });`,
      )
      expect(await fsp.readFile(distFiles[1], 'utf-8')).toContain(
        'declare const _default: () => string;',
      )

      const log = `\
      dist/index.d.ts
      dist/index.js`

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
      expect(await fsp.readFile(distFiles[1], 'utf-8')).toContain(
        'declare function _default(): string;',
      )
    },
  },
  {
    name: 'ts-incremental',
    args: [],
    async expected(dir) {
      // TODO: disable incremental and avoid erroring
      const distFiles = ['./dist/index.js', './dist/index.d.ts']

      for (const f of distFiles) {
        expect(await existsFile(join(dir, f))).toBe(true)
      }
      expect(await fsp.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
        'declare const _default: () => string;',
      )
      expect(await existsFile(join(dir, './dist/.tsbuildinfo'))).toBe(false)
    },
  },
  {
    name: 'ts-no-emit',
    args: [],
    async expected(dir) {
      // should still emit declaration files
      const distFiles = ['./dist/index.js', './dist/index.d.ts']

      for (const f of distFiles) {
        expect(await existsFile(join(dir, f))).toBe(true)
      }
      expect(await fsp.readFile(join(dir, distFiles[1]), 'utf-8')).toContain(
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
      dist/button.d.ts
      dist/server/index.d.ts
      dist/server/index.d.mts
      dist/index.d.ts
      dist/layout/index.d.ts
      dist/server/react-server.d.mts
      dist/lite.d.ts
      dist/server/edge.d.mts
      dist/input.d.ts
      dist/input.js
      dist/lite.js
      dist/button.js
      dist/index.js
      dist/server/react-server.mjs
      dist/layout/index.js
      dist/server/index.mjs
      dist/server/edge.mjs
      `

      const rawStdout = stripANSIColor(stdout)
      getChunkFileNamesFromLog(log).forEach((chunk: string) => {
        expect(rawStdout).toContain(chunk)
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
        'https://github.com/huozhi/bunchee#usage'
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
    name: 'bin/single-path',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/bin.js'),
        join(dir, './dist/bin.d.ts'),
      ]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
      expect(await fsp.readFile(distFiles[0], 'utf-8')).toContain(
        '#!/usr/bin/env node',
      )
    },
  },
  {
    name: 'bin/multi-path',
    args: [],
    async expected(dir) {
      const distBinFiles = [
        join(dir, './dist/bin/a.js'),
        join(dir, './dist/bin/b.js'),
      ]
      const distTypeFiles = [
        join(dir, './dist/bin/a.d.ts'),
        join(dir, './dist/bin/b.d.ts'),
      ]
      const distFiles = distBinFiles.concat(distTypeFiles)

      for (const distFile of distFiles) {
        expect(await existsFile(distFile)).toBe(true)
      }
      for (const distScriptFile of distBinFiles) {
        expect(await fsp.readFile(distScriptFile, 'utf-8')).toContain(
          '#!/usr/bin/env node',
        )
      }
    },
  },
  {
    name: 'bin/cts',
    args: [],
    async expected(dir) {
      const distFiles = [
        join(dir, './dist/bin/index.cjs'),
        join(dir, './dist/bin/index.d.cts'),
      ]

      for (const distFile of distFiles) {
        expect(await existsFile(distFile)).toBe(true)
      }

      expect(await fsp.readFile(distFiles[0], 'utf-8')).toContain(
        '#!/usr/bin/env node',
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
      const esmOutput = await fsp.readFile(
        join(dir, './dist/index.mjs'),
        'utf-8',
      )
      const cjsOutput = await fsp.readFile(
        join(dir, './dist/index.cjs'),
        'utf-8',
      )
      expect(shimsCode.every((code) => esmOutput.includes(code))).toBe(true)
      expect(shimsCode.map((code) => cjsOutput.includes(code))).toEqual([
        false,
        false,
        false,
      ])
      // for import.meta.url, should use pathToFileURL + URL polyfill
      expect(cjsOutput).toContain('pathToFileURL')
      expect(cjsOutput).toContain('new URL')
      expect(cjsOutput).not.toContain('import.meta.url')
    },
  },
  {
    name: 'raw-data',
    args: [],
    async expected(dir) {
      const distFile = join(dir, './dist/index.js')
      expect(await existsFile(distFile)).toBe(true)
      expect(await fsp.readFile(distFile, 'utf-8')).toContain(`"thisismydata"`)
    },
  },
  {
    name: 'server-components',
    args: [],
    async expected(dir) {
      const distFiles = await fsp.readdir(join(dir, 'dist'))

      const requiredFiles = [
        join(dir, 'dist/index.js'),
        join(dir, 'dist/index.cjs'),
        join(dir, 'dist/ui.js'),
        join(dir, 'dist/ui.cjs'),
      ]
      for (const f of requiredFiles) {
        expect(await existsFile(f)).toBe(true)
      }

      // split chunks
      const indexContent = await fsp.readFile(
        join(dir, 'dist/index.js'),
        'utf-8',
      )
      expect(indexContent).not.toContain('use server')
      expect(indexContent).not.toContain('use client')

      // client component chunks will remain the directive
      const clientClientChunkFiles = distFiles.filter((f) =>
        f.includes('client-client-'),
      )
      clientClientChunkFiles.forEach(async (f) => {
        const content = await fsp.readFile(join(dir, 'dist', f), 'utf-8')
        expect(content).toContain('use client')
      })
      expect(clientClientChunkFiles.length).toBe(2) // cjs and esm

      // asset is only being imported to ui, no split
      const assetClientChunkFiles = distFiles.filter((f) =>
        f.includes('_asset-client-'),
      )
      expect(assetClientChunkFiles.length).toBe(0)

      // server component chunks will remain the directive
      const serverChunkFiles = distFiles.filter((f) =>
        f.includes('_actions-server-'),
      )
      serverChunkFiles.forEach(async (f) => {
        const content = await fsp.readFile(join(dir, 'dist', f), 'utf-8')
        expect(content).toContain('use server')
        expect(content).not.toContain('use client')
      })
      expect(serverChunkFiles.length).toBe(2) // cjs and esm

      // For single entry ./ui, client is bundled into client
      const uiEsm = await fsp.readFile(join(dir, 'dist/ui.js'), 'utf-8')
      expect(uiEsm).toContain('use client')
      expect(uiEsm).not.toContain('./_client-client')

      // asset is only being imported to ui, no split
      expect(uiEsm).not.toContain('./_asset-client')
    },
  },
  {
    name: 'server-components-same-layer',
    args: [],
    async expected(dir) {
      const distFiles = await fsp.readdir(join(dir, 'dist'))
      const clientChunkFiles = distFiles.filter((f) =>
        f.includes('client-client-'),
      )
      expect(clientChunkFiles.length).toBe(0)

      // index doesn't have "use client" directive
      const indexCjs = await fsp.readFile(join(dir, 'dist/index.cjs'), 'utf-8')
      const indexEsm = await fsp.readFile(join(dir, 'dist/index.js'), 'utf-8')
      expect(indexCjs).toContain('use client')
      expect(indexEsm).toContain('use client')
    },
  },
  {
    name: 'shared-entry',
    args: [],
    async expected(dir) {
      const distFiles = [
        './dist/index.js',
        './dist/index.mjs',
        './dist/shared.js',
        './dist/shared.mjs',
      ]
      assertContainFiles(dir, distFiles)

      // ESM bundle imports from <pkg/export>
      const indexEsm = await fsp.readFile(
        join(dir, './dist/index.mjs'),
        'utf-8',
      )
      expect(indexEsm).toContain('shared-entry/shared')
      expect(indexEsm).toContain('index-export')
      expect(indexEsm).not.toMatch(/['"]\.\/shared['"]/)
      expect(indexEsm).not.toContain('shared-export')

      // CJS bundle imports from <pkg/export>
      const indexCjs = await fsp.readFile(join(dir, './dist/index.js'), 'utf-8')
      expect(indexCjs).toContain('shared-entry/shared')
      expect(indexCjs).toContain('index-export')
      expect(indexCjs).not.toMatch(/['"]\.\/shared['"]/)

      // shared entry contains its own content
      const sharedEsm = await fsp.readFile(
        join(dir, './dist/shared.mjs'),
        'utf-8',
      )
      expect(sharedEsm).toContain('shared-export')

      // shared entry contains its own content
      const sharedCjs = await fsp.readFile(
        join(dir, './dist/shared.js'),
        'utf-8',
      )
      expect(sharedCjs).toContain('shared-export')
    },
  },
  {
    name: 'default-node-mjs',
    args: [],
    async expected(dir) {
      const distFiles = [join(dir, './dist/index.node.mjs')]
      for (const f of distFiles) {
        expect(await existsFile(f)).toBe(true)
      }
      expect(await fsp.readFile(distFiles[0], 'utf-8')).toContain('export {')
      expect(await fsp.readFile(distFiles[0], 'utf-8')).not.toContain('exports')
    },
  },
  {
    name: 'output',
    args: [],
    async expected(dir, { stdout }) {
      /*
      output:

      Exports          File                        Size
      cli (bin)        dist/cli.js                 103 B
      .                dist/index.js               42 B
      . (react-server) dist/index.react-server.js  55 B
      ./foo            dist/foo.js                 103 B
      */

      const lines = stdout.split('\n')
      const [tableHeads, cliLine, indexLine, indexReactServerLine, fooLine] =
        lines
      expect(tableHeads).toContain('Exports')
      expect(tableHeads).toContain('File')
      expect(tableHeads).toContain('Size')

      expect(cliLine).toContain('cli (bin)')
      expect(cliLine).toContain('dist/cli.js')

      expect(indexLine).toContain('.')
      expect(indexLine).toContain('dist/index.js')

      expect(indexReactServerLine).toContain('. (react-server)')
      expect(indexReactServerLine).toContain('dist/index.react-server.js')

      expect(fooLine).toContain('./foo')
      expect(fooLine).toContain('dist/foo.js')
    },
  },
  {
    name: 'prepare-js',
    args: ['--prepare'],
    async before(dir) {
      await fsp.writeFile(join(dir, './package.json'), '{ "type": "commonjs" }')
    },
    async expected(dir, { stdout }) {
      assertContainFiles(dir, ['package.json'])
      const pkgJson = JSON.parse(
        await fsp.readFile(join(dir, './package.json'), 'utf-8'),
      )
      expect(pkgJson.main).toBe('./dist/index.js')
      expect(pkgJson.module).toBe('./dist/index.mjs')
      expect(pkgJson.types).toBeFalsy()
      expect(pkgJson.files).toContain('dist')
      expect(pkgJson.bin).toBe('./dist/bin/index.js')
      expect(pkgJson.exports).toEqual({
        './foo': {
          import: './dist/foo.mjs',
          require: './dist/foo.js',
        },
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.js',
        },
      })

      /*
        Discovered binaries entries:
          .: bin.js
        Discovered exports entries:
          ./foo: foo.js
          .    : index.js
        ✓ Configured `exports` in package.json
      */
      expect(stdout).toContain('Discovered binaries entries:')
      expect(stdout).toMatch(/.\s*: bin.js/)
      expect(stdout).toContain('Discovered exports entries:')
      expect(stdout).toMatch(/\.\/foo\s*: foo.js/)
      expect(stdout).toMatch(/\.\s*: index.js/)
      expect(stripANSIColor(stdout)).toContain(
        '✓ Configured `exports` in package.json',
      )
    },
  },
  {
    name: 'prepare-ts',
    args: ['--prepare'],
    async before(dir) {
      await deleteFile(join(dir, './package.json'))
      await deleteFile(join(dir, './tsconfig.json'))
    },
    async expected(dir, { stdout }) {
      assertContainFiles(dir, ['package.json'])
      const pkgJson = JSON.parse(
        await fsp.readFile(join(dir, './package.json'), 'utf-8'),
      )
      expect(pkgJson.files).toContain('dist')
      expect(pkgJson.bin).toEqual({
        cli: './dist/bin/cli.js',
        cmd: './dist/bin/cmd.js',
      })
      expect(pkgJson.type).toBe('module')
      expect(pkgJson.main).toBe('./dist/es/index.mjs')
      expect(pkgJson.module).toBe('./dist/es/index.mjs')
      expect(pkgJson.exports).toEqual({
        './foo': {
          import: {
            types: './dist/es/foo.d.mts',
            default: './dist/es/foo.mjs',
          },
          require: {
            types: './dist/cjs/foo.d.cts',
            default: './dist/cjs/foo.cjs',
          },
        },
        '.': {
          'react-server': './dist/es/index-react-server.mjs',
          import: {
            types: './dist/es/index.d.mts',
            default: './dist/es/index.mjs',
          },
          require: {
            types: './dist/cjs/index.d.cts',
            default: './dist/cjs/index.cjs',
          },
        },
      })

      /*
        Discovered binaries entries:
          ./cli: cli.ts
          ./cmd: cmd.ts
        Discovered exports entries:
          ./foo: foo.ts
          .    : index.react-server.ts
          .    : index.ts
        ✓ Configured `exports` in package.json
      */
      expect(stripANSIColor(stdout)).toContain('Detected using TypeScript but tsconfig.json is missing, created a tsconfig.json for you.')
      expect(stdout).toContain('Discovered binaries entries:')
      expect(stdout).toMatch(/\.\s*: index.ts/)
      expect(stdout).toContain('Discovered exports entries:')
      expect(stdout).toMatch(/\.\/foo\s*: foo.ts/)
      expect(stdout).toMatch(/\.\s*: index.react-server.ts/)
      expect(stripANSIColor(stdout)).toContain(
        '✓ Configured `exports` in package.json',
      )
    },
  },
  {
    name: 'prepare-ts-with-pkg-json',
    args: ['--prepare'],
    async before(dir) {
      await fsp.writeFile(join(dir, './package.json'), '{ "name": "prepare-ts-with-pkg-json" }')
      await deleteFile(join(dir, './tsconfig.json'))
    },
    async expected(dir) {
      assertContainFiles(dir, ['package.json'])
      const pkgJson = JSON.parse(
        await fsp.readFile(join(dir, './package.json'), 'utf-8'),
      )
      expect(pkgJson.files).toContain('dist')
      expect(pkgJson.type).toBeUndefined()
      expect(pkgJson.main).toBe('./dist/cjs/index.js')
      expect(pkgJson.module).toBe('./dist/es/index.mjs')
    },
  }
]

async function runBundle(
  dir: string,
  args_: string[],
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  const assetPath = process.env.POST_BUILD
    ? '/../dist/bin/cli.js'
    : '/../src/bin/index.ts'

  const args = (args_ || []).concat(['--cwd', dir])
  const ps = fork(
    `${require.resolve('tsx/cli')}`,
    [__dirname + assetPath].concat(args),
    { stdio: 'pipe' },
  )
  let stderr = '',
    stdout = ''
  ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
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
    const { name, args = [], expected, before } = testCase
    const dir = getPath(name)
    test(`integration ${name}`, async () => {
      debug.log(`Command: bunchee ${args.join(' ')}`)
      execSync(`rm -rf ${join(dir, 'dist')}`)
      if (before) {
        await before(dir)
      }
      const { stdout, stderr } = await runBundle(dir, args)
      stdout && debug.log(stdout)
      stderr && debug.error(stderr)

      await expected(dir, { stdout, stderr })
    })
  }
}

runTests()
