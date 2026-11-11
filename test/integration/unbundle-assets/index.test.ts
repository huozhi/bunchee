import { expect, test } from 'vitest'
import { exec as execCallback, execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'

const exec = promisify(execFile)
const execShell = promisify(execCallback)
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle', '--runtime', 'node'],
})

test('resources, vendored dependencies, and virtual helpers get stable names', async () => {
  expect(job.code).toBe(0)
  expect(job.stdout).toContain(
    '1 module from node_modules was inlined to _vendor/',
  )
  // Exact names: virtual modules wrap absolute paths, and none of them may
  // leak into a published file name.
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
    '_vendor/unbundle-dep/lib/index.cjs',
    '_vendor/unbundle-dep/lib/index.js',
    '_virtual/_vendor_unbundle-dep_lib_index.cjs_commonjs-es-import.cjs',
    '_virtual/_vendor_unbundle-dep_lib_index.cjs_commonjs-es-import.js',
    '_virtual/commonjsHelpers.cjs',
    '_virtual/commonjsHelpers.js',
    '_virtual/native-addon_addon.node.cjs',
    '_virtual/native-addon_addon.node.js',
    '_virtual/wasmHelpers.cjs',
    '_virtual/wasmHelpers.js',
    'data.json.cjs',
    'data.json.js',
    'empty.wasm.cjs',
    'empty.wasm.js',
    'index.cjs',
    'index.js',
    'style.css.cjs',
    'style.css.js',
    'tpl.txt.cjs',
    'tpl.txt.js',
  ])
  const files = await getFileContents(distDir)
  for (const ext of ['js', 'cjs']) {
    expect(files[`style.css.${ext}`]).toContain('function __insertCSS')
    expect(files[`index.${ext}`]).not.toContain('function __insertCSS')
  }
})

test('both formats run, including the native addon and the vendored dependency', async () => {
  for (const ext of ['js', 'cjs']) {
    const url = pathToFileURL(path.join(distDir, `index.${ext}`)).href
    const { stdout } = await exec(process.execPath, [
      '--input-type=module',
      '-e',
      `
      import { createRequire } from 'node:module';
      import { existsSync } from 'node:fs';
      const require = createRequire(import.meta.url);
      require.extensions['.node'] = (module, filename) => { if (!existsSync(filename)) throw Error(filename); module.exports = { answer: 42 } };
      const result = await import(${JSON.stringify(url)});
      console.log(result.addon.answer, result.data.answer, result.text.trim(), result.answer);
    `,
    ])
    expect(stdout.trim()).toBe('42 42 hello 42')
  }
})

test('npm pack publishes every unbundled file, including _vendor and _virtual', async () => {
  // npm drops node_modules directories from a tarball, which is why vendored
  // modules must never be written under one. Ask npm what it would publish.
  // npm is a .cmd script on Windows, so it needs a shell.
  const { stdout } = await execShell(
    'npm pack --dry-run --json --ignore-scripts',
    {
      cwd: __dirname,
      env: {
        ...process.env,
        npm_config_cache: path.join(os.tmpdir(), 'bunchee-unbundle-npm-cache'),
      },
    },
  )
  const [pack] = JSON.parse(stdout)
  const packed = pack.files
    .map((file: { path: string }) => file.path)
    .filter((file: string) => file.startsWith('dist/'))
    .sort()
  const built = (await getFileNamesFromDirectory(distDir))
    .map((file) => `dist/${file}`)
    .concat('dist/addon.node')
    .sort()
  expect(packed).toEqual(built)
})
