import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getOutputFormat,
  getSpecialCondition,
  isTypesTarget,
  parseExports,
  type OutputTarget,
} from './exports'
import type { PackageMetadata } from './types'
import * as wildcard from './wildcard'

// Mock the file system operations
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs')
  return {
    ...actual,
    existsSync: vi.fn(),
  }
})

vi.mock('tinyglobby', async () => {
  const actual = await vi.importActual('tinyglobby')
  return {
    ...actual,
    glob: vi.fn(),
  }
})

const t = (path: string, ...conditions: string[]): OutputTarget => ({
  path,
  conditions,
})

describe('parse-exports', () => {
  const mockCwd = '/test/project'

  beforeEach(() => {
    vi.clearAllMocks()
    // Set up default mock for expandWildcardPattern (returns empty map)
    // This ensures the function is always a spy, even in tests that don't use it
    vi.spyOn(wildcard, 'expandWildcardPattern').mockResolvedValue(new Map())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should parse simple string export', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: './dist/index.js',
    }

    const result = await parseExports(pkg)
    expect(result.get('./index')).toEqual([t('./dist/index.js', 'import')])
  })

  it('should parse exports with import and require conditions', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': {
          import: './dist/index.mjs',
          require: './dist/index.cjs',
        },
      },
    }

    const result = await parseExports(pkg)
    const exports = result.get('./index')
    expect(exports).toEqual(
      expect.arrayContaining([
        t('./dist/index.mjs', 'import'),
        t('./dist/index.cjs', 'require'),
      ]),
    )
  })

  it('should parse exports with types condition', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          default: './dist/index.js',
        },
      },
    }

    const result = await parseExports(pkg)
    const exports = result.get('./index')
    expect(exports).toEqual(
      expect.arrayContaining([
        t('./dist/index.d.ts', 'types'),
        t('./dist/index.js', 'default'),
      ]),
    )
  })

  it('should parse multiple export paths', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': './dist/index.js',
        './lite': './dist/lite.js',
        './utils': './dist/utils.js',
      },
    }

    const result = await parseExports(pkg)
    expect(result.get('./index')).toEqual([t('./dist/index.js', 'default')])
    expect(result.get('./lite')).toEqual([t('./dist/lite.js', 'default')])
    expect(result.get('./utils')).toEqual([t('./dist/utils.js', 'default')])
  })

  it('should parse wildcard exports when cwd is provided', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        './features/*': './dist/features/*.js',
      },
    }

    // Mock expandWildcardPattern to return expanded exports
    const expanded = new Map([
      ['./features/foo', 'foo'],
      ['./features/bar', 'bar'],
    ])
    vi.mocked(wildcard.expandWildcardPattern).mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    // Verify expandWildcardPattern was called
    expect(wildcard.expandWildcardPattern).toHaveBeenCalledWith(
      './features/*',
      mockCwd,
    )

    // Verify wildcard exports were expanded
    expect(result.get('./features/foo')).toEqual([
      t('./dist/features/foo.js', 'default'),
    ])
    expect(result.get('./features/bar')).toEqual([
      t('./dist/features/bar.js', 'default'),
    ])
  })

  it('should not expand wildcard exports when cwd is not provided', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        './features/*': './dist/features/*.js',
      },
    }

    const result = await parseExports(pkg)

    // Should not call expandWildcardPattern when cwd is missing
    expect(wildcard.expandWildcardPattern).not.toHaveBeenCalled()

    // Wildcard pattern should not be expanded
    expect(result.get('./features/foo')).toBeUndefined()
    expect(result.get('./features/bar')).toBeUndefined()
  })

  it('should parse wildcard exports with conditions', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        './features/*': {
          import: './dist/features/*.mjs',
          require: './dist/features/*.cjs',
          types: './dist/features/*.d.ts',
        },
      },
    }

    const expanded = new Map([['./features/foo', 'foo']])
    vi.mocked(wildcard.expandWildcardPattern).mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    const fooExports = result.get('./features/foo')
    expect(fooExports).toEqual(
      expect.arrayContaining([
        t('./dist/features/foo.mjs', 'import'),
        t('./dist/features/foo.cjs', 'require'),
        t('./dist/features/foo.d.ts', 'types'),
      ]),
    )
  })

  it('should parse bin exports', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      bin: './dist/bin/cli.js',
    }

    const result = await parseExports(pkg)
    expect(result.get('$binary')).toEqual([t('./dist/bin/cli.js', 'import')])
  })

  it('should parse multiple bin exports', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      bin: {
        cli: './dist/bin/cli.js',
        server: './dist/bin/server.js',
      },
    }

    const result = await parseExports(pkg)
    expect(result.get('$binary/cli')).toEqual([
      t('./dist/bin/cli.js', 'import'),
    ])
    expect(result.get('$binary/server')).toEqual([
      t('./dist/bin/server.js', 'import'),
    ])
  })

  it('should parse main, module, and types fields', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      main: './dist/index.js',
      module: './dist/index.mjs',
      types: './dist/index.d.ts',
    }

    const result = await parseExports(pkg)
    const exports = result.get('./index')
    expect(exports).toMatchInlineSnapshot(`
      [
        {
          "conditions": [
            "import",
          ],
          "path": "./dist/index.js",
        },
        {
          "conditions": [
            "module",
          ],
          "path": "./dist/index.mjs",
        },
        {
          "conditions": [
            "types",
          ],
          "path": "./dist/index.d.ts",
        },
      ]
    `)
  })

  it('should handle common-js package type', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'commonjs',
      exports: './dist/index.js',
    }

    const result = await parseExports(pkg)
    expect(result.get('./index')).toEqual([t('./dist/index.js', 'require')])
  })

  it('should handle mixed wildcard and normal exports', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': './dist/index.js',
        './utils': './dist/utils.js',
        './features/*': './dist/features/*.js',
      },
    }

    const expanded = new Map([['./features/foo', 'foo']])
    vi.mocked(wildcard.expandWildcardPattern).mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    // Normal exports should work
    expect(result.get('./index')).toEqual([t('./dist/index.js', 'default')])
    expect(result.get('./utils')).toEqual([t('./dist/utils.js', 'default')])

    // Wildcard exports should be expanded
    expect(result.get('./features/foo')).toEqual([
      t('./dist/features/foo.js', 'default'),
    ])
  })

  it('should skip export paths blocked with null', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': './dist/index.js',
        './internal': null,
        './nested': { import: null, require: './dist/nested.cjs' },
      },
    }

    const result = await parseExports(pkg)
    expect(result.get('./index')).toEqual([t('./dist/index.js', 'default')])
    expect(result.get('./internal')).toBeUndefined()
    expect(result.get('./nested')).toEqual([t('./dist/nested.cjs', 'require')])
  })

  it('should skip wildcard export paths blocked with null', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        './features/*': null,
      },
    }

    vi.mocked(wildcard.expandWildcardPattern).mockResolvedValue(
      new Map([['./features/foo', 'foo']]),
    )

    const result = await parseExports(pkg, mockCwd)
    expect(result.get('./features/foo')).toBeUndefined()
  })

  it('should handle nested export conditions', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      exports: {
        '.': {
          'react-server': './dist/index.react-server.js',
          'edge-light': './dist/index.edge-light.js',
          default: './dist/index.js',
        },
      },
    }

    const result = await parseExports(pkg)
    const exports = result.get('./index')
    expect(exports).toEqual(
      expect.arrayContaining([
        t('./dist/index.react-server.js', 'react-server'),
        t('./dist/index.edge-light.js', 'edge-light'),
        t('./dist/index.js', 'default'),
      ]),
    )
  })
})

describe('export condition classification', () => {
  const cjsPkg: PackageMetadata = { name: 'p', type: 'commonjs' }
  const esmPkg: PackageMetadata = { name: 'p', type: 'module' }

  describe('isTypesTarget', () => {
    it('should detect the types condition wherever it is nested', () => {
      expect(isTypesTarget(t('./i.d.ts', 'types'))).toBe(true)
      expect(isTypesTarget(t('./i.d.ts', 'import', 'types'))).toBe(true)
      // `"types": { "import": ..., "require": ... }` nests the other way around
      expect(isTypesTarget(t('./i.d.mts', 'types', 'import'))).toBe(true)
      expect(
        isTypesTarget(t('./i.d.cts', 'development', 'require', 'types')),
      ).toBe(true)
    })

    it('should not treat JS conditions as types', () => {
      expect(isTypesTarget(t('./i.js', 'import', 'default'))).toBe(false)
      expect(
        isTypesTarget(t('./i.js', 'development', 'import', 'default')),
      ).toBe(false)
    })
  })

  describe('getSpecialCondition', () => {
    it('should find the runtime or optimize condition', () => {
      expect(getSpecialCondition(t('./i.js', 'development', 'import'))).toBe(
        'development',
      )
      expect(getSpecialCondition(t('./i.js', 'react-server', 'default'))).toBe(
        'react-server',
      )
    })

    it('should fall back to default', () => {
      expect(getSpecialCondition(t('./i.js', 'import', 'default'))).toBe(
        'default',
      )
    })
  })

  describe('getOutputFormat', () => {
    it('should decide by extension first', () => {
      expect(getOutputFormat(esmPkg, t('./i.cjs', 'require', 'default'))).toBe(
        'cjs',
      )
      expect(getOutputFormat(cjsPkg, t('./i.mjs', 'import', 'default'))).toBe(
        'esm',
      )
    })

    it('should follow package type for extensionless-ambiguous .js', () => {
      expect(getOutputFormat(esmPkg, t('./i.js', 'import', 'default'))).toBe(
        'esm',
      )
      expect(getOutputFormat(cjsPkg, t('./i.js', 'require', 'default'))).toBe(
        'cjs',
      )
      expect(getOutputFormat(cjsPkg, t('./i.js', 'default'))).toBe('cjs')
    })

    it('should honour a nested esm condition in a cjs package', () => {
      // Regression: the composed condition used to be compared as a whole
      // string, so `import.default` never registered as esm.
      expect(getOutputFormat(cjsPkg, t('./i.js', 'import', 'default'))).toBe(
        'esm',
      )
      expect(
        getOutputFormat(
          cjsPkg,
          t('./i.js', 'development', 'import', 'default'),
        ),
      ).toBe('esm')
      expect(getOutputFormat(cjsPkg, t('./i.js', 'module', 'default'))).toBe(
        'esm',
      )
    })

    it('should let an explicit require condition win for .mjs in a cjs package', () => {
      expect(getOutputFormat(cjsPkg, t('./i.mjs', 'require'))).toBe('cjs')
      expect(getOutputFormat(esmPkg, t('./i.mjs', 'require'))).toBe('esm')
    })
  })
})
