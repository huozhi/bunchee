import { beforeAll, expect, test, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { stripVTControlCharacters } from 'util'
import { rollup } from 'rollup'
import prettyBytes from 'pretty-bytes'
import {
  createOutputState,
  logOutputState,
  type SizeStats,
} from './output-state-plugin'

let fixture: Awaited<ReturnType<typeof buildPackageWithSharedChunkAndAssets>>

beforeAll(async () => {
  fixture = await buildPackageWithSharedChunkAndAssets()
})

test('shows shared chunks and assets that the entry-only size table omitted', () => {
  expect(fixture.output).toMatch(/^\. a.js \d+ B$/m)
  expect(fixture.output).toMatch(/^\.\/b b.js \d+ B$/m)
  expect(fixture.output).toMatch(/^Shared chunks shared.js \d+ B$/m)
  expect(fixture.output).toMatch(/^Assets text.txt 6 B$/m)
  expect(fixture.output).toContain('binary.bin 3 B')

  expect([...fixture.stats.keys()].sort()).toEqual([
    'a.js',
    'a.js.map',
    'b.js',
    'b.js.map',
    'binary.bin',
    'shared.js',
    'shared.js.map',
    'text.txt',
  ])
})

test('reports Unicode in bytes: "你好" is 6 bytes, not 2 characters', () => {
  expect(fixture.files.get('text.txt')!.toString()).toBe('你好')
  expect(fixture.stats.get('text.txt')).toBe(6)

  const sharedCode = fixture.files.get('shared.js')!.toString()
  expect(sharedCode).toContain('你好')
  expect(fixture.stats.get('shared.js')).toBe(sharedCode.length + 4)
})

test('the total includes every written file, including shared code, assets, and sourcemaps', () => {
  let totalBytes = 0
  for (const [file, contents] of fixture.files) {
    expect(fixture.stats.get(file), file).toBe(contents.byteLength)
    totalBytes += contents.byteLength
  }
  expect(fixture.output.split('\n').at(-1)).toBe(
    `Total: ${prettyBytes(totalBytes)} in 8 files`,
  )
})

test('merging a newer report updates an output size without counting the file twice', () => {
  const state = createOutputState({ entries: {} })
  state.mergeSizeStats(new Map([['.', [['a.js', '/a.js', 10]]]]))
  state.mergeSizeStats(
    new Map([
      [
        '.',
        [
          ['a.js', '/a.js', 20],
          ['b.js', '/b.js', 30],
        ],
      ],
    ]),
  )

  expect(state.getSizeStats().get('.')).toEqual([
    ['a.js', '/a.js', 20],
    ['b.js', '/b.js', 30],
  ])
  expect(captureTable(state.getSizeStats()).split('\n').at(-1)).toBe(
    'Total: 50 B in 2 files',
  )
})

function captureTable(stats: SizeStats): string {
  const log = vi.spyOn(console, 'log').mockImplementation(() => {})
  try {
    logOutputState(stats)
    return log.mock.calls
      .map((args) =>
        stripVTControlCharacters(args.join(' ')).trim().replace(/ +/g, ' '),
      )
      .join('\n')
  } finally {
    log.mockRestore()
  }
}

async function buildPackageWithSharedChunkAndAssets() {
  const dir = await mkdtemp(path.join(tmpdir(), 'bunchee-sizes-'))
  const modules: Record<string, string> = {
    '/a.js': "import { value } from '/shared.js'; export const a = value + 'a'",
    '/b.js': "import { value } from '/shared.js'; export const b = value + 'b'",
    '/shared.js': "export const value = '你好'",
  }
  const state = createOutputState({
    entries: {
      '.': { name: '.', source: '/a.js', targets: [] },
      './b': { name: './b', source: '/b.js', targets: [] },
    },
  })
  const bundle = await rollup({
    input: { a: '/a.js', b: '/b.js' },
    plugins: [
      {
        name: 'fixture',
        resolveId(id) {
          return id in modules ? id : null
        },
        load(id) {
          return modules[id]
        },
        buildStart() {
          this.emitFile({ type: 'asset', fileName: 'text.txt', source: '你好' })
          this.emitFile({
            type: 'asset',
            fileName: 'binary.bin',
            source: new Uint8Array([0, 127, 255]),
          })
        },
      },
      state.plugin(dir),
    ],
  })
  try {
    await bundle.write({
      dir,
      format: 'es',
      sourcemap: true,
      chunkFileNames: 'shared.js',
    })
    const files = new Map<string, Buffer>()
    for (const file of await readdir(dir)) {
      files.set(file, await readFile(path.join(dir, file)))
    }
    const stats = new Map(
      [...state.getSizeStats().values()]
        .flat()
        .map(([file, , bytes]) => [file, bytes]),
    )
    return { files, stats, output: captureTable(state.getSizeStats()) }
  } finally {
    await bundle.close()
    await rm(dir, { recursive: true, force: true })
  }
}
