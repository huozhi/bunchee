import { expect, test } from 'vitest'
import { execFile } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { pathToFileURL } from 'url'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle', '--runtime', 'node'],
})
test('resources keep their source extension and CSS helpers stay in the CSS module', async () => {
  expect(job.code).toBe(0)
  expect(await getFileNamesFromDirectory(distDir)).toEqual([
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
    for (const name of ['data.json', 'tpl.txt', 'style.css', 'empty.wasm'])
      expect(files[`${name}.${ext}`]).toBeDefined()
    expect(files[`style.css.${ext}`]).toContain('function __insertCSS')
    expect(files[`index.${ext}`]).not.toContain('function __insertCSS')
  }
})
test('native addon wrappers resolve the emitted binary from their virtual subdirectory', async () => {
  const exec = promisify(execFile)
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
      console.log(result.addon.answer, result.data.answer, result.text.trim());
    `,
    ])
    expect(stdout.trim()).toBe('42 42 hello')
  }
})
