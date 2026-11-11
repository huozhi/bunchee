import { describe, expect, test } from 'vitest'
import { resolve } from 'path'
import type { PreRenderedChunk } from 'rollup'
import {
  createUnbundleFileNames,
  getConditionSuffix,
  getUnbundleOutputPath,
} from './paths'

const dir = resolve('/output')
const srcRoot = resolve('/package/src')
const output = (moduleId: string, ext = '.js', suffix = '') =>
  getUnbundleOutputPath({ moduleId, dir, srcRoot, ext, suffix })

describe('unbundle output paths', () => {
  test.each(['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'])(
    'R2: mirrors nested .%s source modules without their source extension',
    (ext) => {
      expect(output(resolve(srcRoot, `utils/format.${ext}`))).toBe(
        resolve(dir, 'utils/format.js'),
      )
    },
  )
  test.each(['data.json', 'tpl.txt?raw', 'style.css', 'code.wasm'])(
    'R3: preserves the complete resource filename for %s',
    (file) => {
      expect(output(resolve(srcRoot, file))).toBe(
        resolve(dir, file.split('?')[0] + '.js'),
      )
    },
  )
  test('R2/R3: JSON and TypeScript modules with the same basename stay distinct', () => {
    expect(output(resolve(srcRoot, 'data.json'))).not.toBe(
      output(resolve(srcRoot, 'data.ts')),
    )
  })
  test('R4: vendors the path after the last node_modules segment', () => {
    expect(
      output(
        resolve(
          '/package/node_modules/.pnpm/foo@1/node_modules/@foo/bar/lib/a.js',
        ),
      ),
    ).toBe(resolve(dir, '_vendor/@foo/bar/lib/a.js'))
    expect(output(resolve('/package/node_modules/foo/data.json'), '.cjs')).toBe(
      resolve(dir, '_vendor/foo/data.json.cjs'),
    )
  })
  test('R4: virtual modules receive portable names under _virtual', () => {
    expect(output('\0commonjsHelpers.js')).toBe(
      resolve(dir, '_virtual/commonjsHelpers.js'),
    )
    expect(output('\0/path:to/module?proxy')).toBe(
      resolve(dir, '_virtual/module_proxy.js'),
    )
  })
  test('R4: virtual names never embed the absolute build path', () => {
    const named = (moduleId: string, ext = '.js') =>
      getUnbundleOutputPath({
        moduleId,
        dir,
        srcRoot,
        rootDir: resolve('/package'),
        ext,
        suffix: '',
      })
    expect(
      named(
        '\0' +
          resolve('/package/node_modules/dep/lib/index.cjs') +
          '?commonjs-es-import',
      ),
    ).toBe(
      resolve(dir, '_virtual/_vendor_dep_lib_index.cjs_commonjs-es-import.js'),
    )
    expect(
      named('\0native-addon:' + resolve(srcRoot, 'native/addon.node'), '.cjs'),
    ).toBe(resolve(dir, '_virtual/native-addon_native_addon.node.cjs'))
    expect(named('\0' + resolve('/package/scripts/gen.js') + '?proxy')).toBe(
      resolve(dir, '_virtual/scripts_gen.js_proxy.js'),
    )
    expect(named('\0wasmHelpers.js')).toBe(
      resolve(dir, '_virtual/wasmHelpers.js'),
    )
  })
  test('R4: rejects sibling paths and prefix lookalikes outside the source root', () => {
    for (const file of ['/package/shared/x.ts', '/package/src-other/x.ts']) {
      expect(() => output(resolve(file))).toThrow(
        expect.objectContaining({ name: 'BUNCHEE_UNBUNDLE_OUTSIDE_ROOT' }),
      )
    }
  })
  test('R5: appends conditions before the output extension, including declarations', () => {
    expect(
      output(
        resolve(srcRoot, 'utils.ts'),
        '.d.cts',
        '.development.react-server',
      ),
    ).toBe(resolve(dir, 'utils.development.react-server.d.cts'))
  })
  test('R5: follows condition order in the exports filename and ignores format conditions', () => {
    expect(
      getConditionSuffix({
        path: './dist/index.development.react-server.js',
        conditions: ['react-server', 'development', 'import', 'default'],
      }),
    ).toBe('.development.react-server')
    expect(
      getConditionSuffix({
        path: './dist/server.js',
        conditions: ['react-server', 'import'],
      }),
    ).toBe('.react-server')
    expect(
      getConditionSuffix({
        path: './dist/index.js',
        conditions: ['import', 'default'],
      }),
    ).toBe('')
  })
  test('R7: refuses generated paths containing a node_modules directory', () => {
    expect(() =>
      output(resolve(srcRoot, 'node_modules/unpublishable.ts')),
    ).not.toThrow()
    // An installed dependency is remapped to _vendor; explicit entry outputs
    // containing node_modules must still be rejected.
    const names = createUnbundleFileNames({
      dir,
      srcRoot,
      ext: '.js',
      suffix: '',
      registry: new Map(),
      outputFilesBySource: new Map([
        ['entry', resolve(dir, 'node_modules/entry.js')],
      ]),
    })
    expect(() => names(chunk('entry', true))).toThrow(
      expect.objectContaining({ name: 'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT' }),
    )
  })
})

function chunk(id: string, isEntry = false): PreRenderedChunk {
  return {
    facadeModuleId: id,
    isEntry,
    name: 'entry',
    exports: [],
    isDynamicEntry: false,
    moduleIds: [id],
  }
}

test('R1/R6: honors exports paths and detects collisions across naming callbacks', () => {
  const registry = new Map<string, string>()
  const names = () =>
    createUnbundleFileNames({
      dir,
      srcRoot,
      ext: '.js',
      suffix: '.react-server',
      registry,
      outputFilesBySource: new Map([
        [resolve(srcRoot, 'foo.ts'), resolve(dir, 'bar.react-server.js')],
      ]),
    })
  expect(names()(chunk(resolve(srcRoot, 'foo.ts'), true))).toBe(
    'bar.react-server.js',
  )
  expect(names()(chunk(resolve(srcRoot, 'foo.ts'), true))).toBe(
    'bar.react-server.js',
  )
  expect(() => names()(chunk(resolve(srcRoot, 'bar.ts')))).toThrow(
    expect.objectContaining({ name: 'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT' }),
  )
})

test('R6: refuses extension collisions instead of allowing Rollup numeric suffixes', () => {
  const names = createUnbundleFileNames({
    dir,
    srcRoot,
    ext: '.js',
    suffix: '',
    registry: new Map(),
    outputFilesBySource: new Map(),
  })
  names(chunk(resolve(srcRoot, 'a.ts')))
  expect(() => names(chunk(resolve(srcRoot, 'a.tsx')))).toThrow(
    /a\.ts.*a\.tsx.*a\.js/,
  )
})

test('R7: refuses an output root itself nested under node_modules', () => {
  expect(() =>
    getUnbundleOutputPath({
      moduleId: resolve(srcRoot, 'utils.ts'),
      dir: resolve('/output/node_modules/pkg'),
      srcRoot,
      ext: '.js',
      suffix: '',
    }),
  ).toThrow(
    expect.objectContaining({ name: 'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT' }),
  )
})
