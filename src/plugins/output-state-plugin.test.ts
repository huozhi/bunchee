import { expect, test, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm } from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { rollup } from 'rollup'
import { createOutputState, logOutputState } from './output-state-plugin'

test('reports actual bytes for entries, shared chunks, assets, and sourcemaps', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'bunchee-sizes-'))
  const modules: Record<string, string> = {
    '/a.js': "import { value } from '/shared.js'; export const a = value + 'a'",
    '/b.js': "import { value } from '/shared.js'; export const b = value + 'b'",
    '/shared.js': "export const value = '你好'",
  }
  const state = createOutputState({ entries: {} })
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
    await bundle.write({ dir, format: 'es', sourcemap: true })
    const files = await readdir(dir)
    const stats = [...state.getSizeStats().values()].flat()
    expect(stats.map(([file]) => file).sort()).toEqual(files.sort())
    for (const [file, , bytes] of stats) {
      expect(bytes).toBe((await readFile(path.join(dir, file))).byteLength)
    }
    expect(stats.find(([file]) => file === 'text.txt')?.[2]).toBe(6)
    expect(stats.find(([file]) => file === 'binary.bin')?.[2]).toBe(3)
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      logOutputState(state.getSizeStats())
      const output = log.mock.calls.map((args) => args.join(' ')).join('\n')
      expect(output).toContain('Shared chunks')
      expect(output).toContain('Assets')
      expect(output).toMatch(new RegExp(`Total: .* in ${files.length} files`))
    } finally {
      log.mockRestore()
    }

    // An output reported again (by a worker or another write) replaces its
    // size without duplicating the file in the total.
    state.mergeSizeStats(new Map([['.', [['a.js', '/a.js', 123]]]]))
    const merged = [...state.getSizeStats().values()].flat()
    expect(merged).toHaveLength(files.length)
    expect(merged.find(([file]) => file === 'a.js')?.[2]).toBe(123)
  } finally {
    await bundle.close()
    await rm(dir, { recursive: true, force: true })
  }
})
