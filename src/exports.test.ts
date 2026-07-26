import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  getFileExportType,
  isCjsExportName,
  isEsmExportName,
  parseExports,
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
    expect(result.get('./index')).toEqual([['./dist/index.js', 'import']])
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
        ['./dist/index.mjs', 'import'],
        ['./dist/index.cjs', 'require'],
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
        ['./dist/index.d.ts', 'types'],
        ['./dist/index.js', 'default'],
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
    expect(result.get('./index')).toEqual([['./dist/index.js', 'default']])
    expect(result.get('./lite')).toEqual([['./dist/lite.js', 'default']])
    expect(result.get('./utils')).toEqual([['./dist/utils.js', 'default']])
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
      ['./dist/features/foo.js', 'default'],
    ])
    expect(result.get('./features/bar')).toEqual([
      ['./dist/features/bar.js', 'default'],
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
        ['./dist/features/foo.mjs', 'import'],
        ['./dist/features/foo.cjs', 'require'],
        ['./dist/features/foo.d.ts', 'types'],
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
    expect(result.get('$binary')).toEqual([['./dist/bin/cli.js', 'import']])
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
    expect(result.get('$binary/cli')).toEqual([['./dist/bin/cli.js', 'import']])
    expect(result.get('$binary/server')).toEqual([
      ['./dist/bin/server.js', 'import'],
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
        [
          "./dist/index.js",
          "import",
        ],
        [
          "./dist/index.mjs",
          "module",
        ],
        [
          "./dist/index.d.ts",
          "types",
        ],
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
    expect(result.get('./index')).toEqual([['./dist/index.js', 'require']])
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
    expect(result.get('./index')).toEqual([['./dist/index.js', 'default']])
    expect(result.get('./utils')).toEqual([['./dist/utils.js', 'default']])

    // Wildcard exports should be expanded
    expect(result.get('./features/foo')).toEqual([
      ['./dist/features/foo.js', 'default'],
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
    expect(result.get('./index')).toEqual([['./dist/index.js', 'default']])
    expect(result.get('./internal')).toBeUndefined()
    expect(result.get('./nested')).toEqual([['./dist/nested.cjs', 'require']])
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
        ['./dist/index.react-server.js', 'react-server'],
        ['./dist/index.edge-light.js', 'edge-light'],
        ['./dist/index.js', 'default'],
      ]),
    )
  })
})

describe('export condition classification', () => {
  describe('getFileExportType', () => {
    it('should detect the types condition wherever it is nested', () => {
      expect(getFileExportType('types')).toBe('types')
      expect(getFileExportType('import.types')).toBe('types')
      // `"types": { "import": ..., "require": ... }` nests the other way around
      expect(getFileExportType('types.import')).toBe('types')
      expect(getFileExportType('types.require')).toBe('types')
      expect(getFileExportType('development.require.types')).toBe('types')
    })

    it('should return the last condition for non-types conditions', () => {
      expect(getFileExportType('import.default')).toBe('default')
      expect(getFileExportType('development.import.default')).toBe('default')
      expect(getFileExportType('require')).toBe('require')
    })
  })

  describe('isEsmExportName', () => {
    it('should match esm conditions nested in a composed condition', () => {
      expect(isEsmExportName('import', 'js')).toBe(true)
      expect(isEsmExportName('import.default', 'js')).toBe(true)
      expect(isEsmExportName('development.import.default', 'js')).toBe(true)
      expect(isEsmExportName('module.default', 'js')).toBe(true)
      expect(isEsmExportName('module-sync.default', 'js')).toBe(true)
    })

    it('should not match cjs conditions', () => {
      expect(isEsmExportName('require.default', 'js')).toBe(false)
      expect(isEsmExportName('default', 'js')).toBe(false)
    })

    it('should always treat .mjs as esm', () => {
      expect(isEsmExportName('require', 'mjs')).toBe(true)
    })
  })

  describe('isCjsExportName', () => {
    const cjsPkg: PackageMetadata = { name: 'p', type: 'commonjs' }
    const esmPkg: PackageMetadata = { name: 'p', type: 'module' }

    it('should not classify a nested import condition as cjs', () => {
      expect(isCjsExportName(cjsPkg, 'import', 'js')).toBe(false)
      expect(isCjsExportName(cjsPkg, 'import.default', 'js')).toBe(false)
      expect(isCjsExportName(cjsPkg, 'development.import.default', 'js')).toBe(
        false,
      )
    })

    it('should classify require conditions in a cjs package as cjs', () => {
      expect(isCjsExportName(cjsPkg, 'require', 'js')).toBe(true)
      expect(isCjsExportName(cjsPkg, 'require.default', 'js')).toBe(true)
      expect(isCjsExportName(cjsPkg, 'default', 'js')).toBe(true)
    })

    it('should classify by extension in an esm package', () => {
      expect(isCjsExportName(esmPkg, 'require.default', 'cjs')).toBe(true)
      expect(isCjsExportName(esmPkg, 'import.default', 'js')).toBe(false)
    })
  })
})
