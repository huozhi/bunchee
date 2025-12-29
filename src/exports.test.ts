import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { parseExports } from './exports'
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
    // Mock expandWildcardPattern
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
    expect(exports).toBeDefined()
    expect(exports?.some(([path]) => path === './dist/index.mjs')).toBe(true)
    expect(exports?.some(([path]) => path === './dist/index.cjs')).toBe(true)
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
    expect(exports).toBeDefined()
    expect(
      exports?.some(
        ([path, type]) =>
          path === './dist/index.d.ts' && type.includes('types'),
      ),
    ).toBe(true)
    expect(
      exports?.some(
        ([path, type]) =>
          path === './dist/index.js' && type.includes('default'),
      ),
    ).toBe(true)
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
    expect(result.get('./index')).toBeDefined()
    expect(result.get('./lite')).toBeDefined()
    expect(result.get('./utils')).toBeDefined()
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
    vi.spyOn(wildcard, 'expandWildcardPattern').mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    // Verify expandWildcardPattern was called
    expect(wildcard.expandWildcardPattern).toHaveBeenCalledWith(
      './features/*',
      mockCwd,
    )

    // Verify wildcard exports were expanded
    expect(result.get('./features/foo')).toBeDefined()
    expect(result.get('./features/bar')).toBeDefined()

    // Verify wildcards were substituted in output paths
    const fooExports = result.get('./features/foo')
    expect(
      fooExports?.some(([path]) => path === './dist/features/foo.js'),
    ).toBe(true)

    const barExports = result.get('./features/bar')
    expect(
      barExports?.some(([path]) => path === './dist/features/bar.js'),
    ).toBe(true)
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
    vi.spyOn(wildcard, 'expandWildcardPattern').mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    const fooExports = result.get('./features/foo')
    expect(fooExports).toBeDefined()
    expect(
      fooExports?.some(([path]) => path === './dist/features/foo.mjs'),
    ).toBe(true)
    expect(
      fooExports?.some(([path]) => path === './dist/features/foo.cjs'),
    ).toBe(true)
    expect(
      fooExports?.some(([path]) => path === './dist/features/foo.d.ts'),
    ).toBe(true)
  })

  it('should parse bin exports', async () => {
    const pkg: PackageMetadata = {
      name: 'test-pkg',
      type: 'module',
      bin: './dist/bin/cli.js',
    }

    const result = await parseExports(pkg)
    expect(result.get('$binary')).toBeDefined()
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
    expect(result.get('$binary/cli')).toBeDefined()
    expect(result.get('$binary/server')).toBeDefined()
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
    vi.spyOn(wildcard, 'expandWildcardPattern').mockResolvedValue(expanded)

    const result = await parseExports(pkg, mockCwd)

    // Normal exports should work
    expect(result.get('./index')).toBeDefined()
    expect(result.get('./utils')).toBeDefined()

    // Wildcard exports should be expanded
    expect(result.get('./features/foo')).toBeDefined()
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
    expect(exports).toBeDefined()
    expect(
      exports?.some(
        ([path, type]) =>
          path === './dist/index.react-server.js' &&
          type.includes('react-server'),
      ),
    ).toBe(true)
    expect(
      exports?.some(
        ([path, type]) =>
          path === './dist/index.edge-light.js' && type.includes('edge-light'),
      ),
    ).toBe(true)
    expect(
      exports?.some(
        ([path, type]) =>
          path === './dist/index.js' && type.includes('default'),
      ),
    ).toBe(true)
  })
})
