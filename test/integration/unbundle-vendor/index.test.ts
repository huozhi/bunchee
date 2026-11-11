import { expect, test } from 'vitest'
import { createJob, getFileNamesFromDirectory } from '../../testing-utils'
import { execFile } from 'child_process'
import { promisify } from 'util'
import os from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
const { job, distDir } = createJob({
  directory: __dirname,
  args: ['--unbundle', '--runtime', 'node'],
})
test('inlined dependencies and CommonJS virtual helpers remain publishable and executable', async () => {
  expect(job.code).toBe(0)
  expect(job.stdout).toContain(
    '1 module from node_modules was inlined to _vendor/',
  )
  const files = await getFileNamesFromDirectory(distDir)
  // Exact names: virtual modules wrapping a dependency must not embed the
  // absolute path of the machine that built the package.
  expect(files).toEqual([
    '_vendor/unbundle-dep/lib/index.js',
    '_virtual/_vendor_unbundle-dep_lib_index.cjs_commonjs-es-import.js',
    '_virtual/commonjsHelpers.js',
    'index.js',
  ])
  const { stdout } = await promisify(execFile)(process.execPath, [
    '--input-type=module',
    '-e',
    `import { answer } from ${JSON.stringify(pathToFileURL(path.join(distDir, 'index.js')).href)}; console.log(answer)`,
  ])
  expect(stdout.trim()).toBe('42')
})

test('npm pack publishes every unbundled file, including _vendor and _virtual', async () => {
  // npm drops node_modules directories from a tarball, which is why vendored
  // modules must never be written under one. Ask npm what it would publish.
  const { stdout } = await promisify(execFile)(
    'npm',
    ['pack', '--dry-run', '--json', '--ignore-scripts'],
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
    .sort()
  expect(packed).toEqual(built)
})
