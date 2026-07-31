#!/usr/bin/env node

import assert from 'node:assert/strict'
import { execFile as execFileCallback } from 'node:child_process'
import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execFile = promisify(execFileCallback)
const root = path.resolve(import.meta.dirname, '..')
const tempDir = await mkdtemp(path.join(tmpdir(), 'bunchee-package-smoke-'))

async function run(command, args, options = {}) {
  return execFile(command, args, {
    ...options,
    maxBuffer: 10 * 1024 * 1024,
  })
}

try {
  const packDir = path.join(tempDir, 'packed')
  await mkdir(packDir)

  const { stdout: packOutput } = await run(
    'npm',
    ['pack', '--json', '--ignore-scripts', '--pack-destination', packDir],
    {
      cwd: root,
      env: {
        ...process.env,
        npm_config_cache: path.join(tempDir, 'npm-cache'),
      },
    },
  )
  const [packResult] = JSON.parse(packOutput)
  const packedFiles = new Set(packResult.files.map((file) => file.path))
  for (const expected of [
    'README.md',
    'package.json',
    'dist/index.js',
    'dist/index.d.ts',
    'dist/bin/cli.js',
  ]) {
    assert(packedFiles.has(expected), `tarball is missing ${expected}`)
  }

  const tarball = path.join(packDir, packResult.filename)
  await run('tar', ['-xzf', tarball, '-C', tempDir])

  // Let the unpacked package resolve the dependencies installed for this
  // checkout without downloading a second dependency tree.
  await symlink(
    path.join(root, 'node_modules'),
    path.join(tempDir, 'node_modules'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )

  const unpackedPackage = path.join(tempDir, 'package')
  const packedApi = await import(
    pathToFileURL(path.join(unpackedPackage, 'dist/index.js')).href
  )
  assert.equal(typeof packedApi.bundle, 'function')

  const consumerDir = path.join(tempDir, 'consumer')
  await mkdir(path.join(consumerDir, 'src', 'bin'), { recursive: true })
  await writeFile(
    path.join(consumerDir, 'package.json'),
    JSON.stringify(
      {
        name: 'bunchee-package-smoke-consumer',
        type: 'module',
        exports: {
          '.': {
            import: {
              types: './dist/index.d.ts',
              default: './dist/index.js',
            },
            require: {
              types: './dist/index.d.cts',
              default: './dist/index.cjs',
            },
          },
        },
        bin: './dist/bin/cli.js',
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(consumerDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          strict: true,
          target: 'ES2022',
        },
      },
      null,
      2,
    ),
  )
  await writeFile(
    path.join(consumerDir, 'src/index.ts'),
    'export const answer = 42\n',
  )
  await writeFile(
    path.join(consumerDir, 'src/bin/index.ts'),
    "console.log('packed-bunchee-bin')\n",
  )

  const packedCli = path.join(unpackedPackage, 'dist/bin/cli.js')
  await run(process.execPath, [packedCli, '--runtime', 'node'], {
    cwd: consumerDir,
  })

  const esm = await import(
    pathToFileURL(path.join(consumerDir, 'dist/index.js')).href
  )
  assert.equal(esm.answer, 42)

  const cjsCheck = await run(
    process.execPath,
    [
      '-e',
      `const value = require(${JSON.stringify(path.join(consumerDir, 'dist/index.cjs'))}); if (value.answer !== 42) process.exit(1)`,
    ],
    { cwd: consumerDir },
  )
  assert.equal(cjsCheck.stderr, '')

  for (const declaration of ['dist/index.d.ts', 'dist/index.d.cts']) {
    assert.match(
      await readFile(path.join(consumerDir, declaration), 'utf8'),
      /answer = 42/,
    )
  }

  await writeFile(
    path.join(consumerDir, 'consume.ts'),
    "import { answer } from 'bunchee-package-smoke-consumer'\nconst value: 42 = answer\n",
  )
  await writeFile(
    path.join(consumerDir, 'consume.cts'),
    "import packageValue = require('bunchee-package-smoke-consumer')\nconst value: 42 = packageValue.answer\n",
  )
  await writeFile(
    path.join(consumerDir, 'tsconfig.consume.json'),
    JSON.stringify(
      {
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          noEmit: true,
          strict: true,
          target: 'ES2022',
          types: [],
        },
        include: ['consume.ts', 'consume.cts'],
      },
      null,
      2,
    ),
  )
  await run(
    path.join(root, 'node_modules', '.bin', 'tsc'),
    ['-p', 'tsconfig.consume.json'],
    { cwd: consumerDir },
  )

  const consumerBin = path.join(consumerDir, 'dist/bin/cli.js')
  assert.match(await readFile(consumerBin, 'utf8'), /^#!\/usr\/bin\/env node/)
  const { stdout: binOutput } = await run(process.execPath, [consumerBin], {
    cwd: consumerDir,
  })
  assert.equal(binOutput.trim(), 'packed-bunchee-bin')

  console.log(`Packed package smoke test passed: ${packResult.filename}`)
} finally {
  await rm(tempDir, { recursive: true, force: true })
}
