import { expect, test } from 'vitest'
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { createRequire } from 'module'
import { rollup } from 'rollup'
import { convertCompilerOptions } from '../../typescript'
import { createUnbundleFileNames } from './paths'

// RFC step 2: exercise the installed declaration plugin before wiring unbundle
// into Bunchee. Both public inputs depend on one nested declaration module.
test('declaration plugin preserves modules and rewrites .d.cts imports to .cjs', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'bunchee-dts-spike-'))
  const srcRoot = path.join(root, 'src')
  await mkdir(path.join(srcRoot, 'utils'), { recursive: true })
  await writeFile(
    path.join(root, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        declarationMap: true,
      },
    }),
  )
  await writeFile(
    path.join(srcRoot, 'index.ts'),
    "export { create } from './utils/create'\nexport type { Shared } from './utils/types'",
  )
  await writeFile(
    path.join(srcRoot, 'other.ts'),
    "export type { Shared } from './utils/types'",
  )
  await writeFile(
    path.join(srcRoot, 'utils/create.ts'),
    "import type { Shared } from './types'; export function create(): Shared { return { value: 42 } }",
  )
  await writeFile(
    path.join(srcRoot, 'utils/types.ts'),
    'export interface Shared { value: number }',
  )
  try {
    await convertCompilerOptions(process.cwd(), {})
    const dts = (
      createRequire(import.meta.url)(
        'rollup-plugin-dts',
      ) as typeof import('rollup-plugin-dts')
    ).default
    const bundle = await rollup({
      input: {
        index: path.join(srcRoot, 'index.ts'),
        other: path.join(srcRoot, 'other.ts'),
      },
      plugins: [dts({ tsconfig: path.join(root, 'tsconfig.json') })],
    })
    try {
      for (const ext of ['.d.ts', '.d.cts', '.d.mts']) {
        const { output } = await bundle.generate({
          format: 'es',
          preserveModules: true,
          sourcemap: true,
          entryFileNames: createUnbundleFileNames({
            dir: path.join(root, 'dist'),
            srcRoot,
            ext,
            suffix: '',
            registry: new Map(),
            outputFilesBySource: new Map(),
          }),
        })
        const chunks = Object.fromEntries(
          output
            .filter((file) => file.type === 'chunk')
            .map((file) => [file.fileName, file.code]),
        )
        expect(chunks[`utils/create${ext}`]).toContain(
          `'./types.${ext === '.d.cts' ? 'cjs' : ext === '.d.mts' ? 'mjs' : 'js'}'`,
        )
        expect(
          output.some((file) => file.fileName === `utils/create${ext}.map`),
        ).toBe(true)
      }
    } finally {
      await bundle.close()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
