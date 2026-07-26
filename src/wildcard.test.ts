import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  hasWildcardPattern,
  substituteWildcardInPath,
  expandWildcardPattern,
  wildcardPatternToGlob,
} from './wildcard'
import { existsSync } from 'fs'
import { glob } from 'tinyglobby'
import * as utils from './utils'

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

vi.mock('./utils', () => ({
  fileExists: vi.fn(),
  normalizePath: (p: string) => p.replace(/\\/g, '/'),
}))

describe('wildcard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('hasWildcardPattern', () => {
    it('should detect wildcard pattern in export key', () => {
      expect(hasWildcardPattern('./features/*')).toBe(true)
      expect(hasWildcardPattern('./components/*')).toBe(true)
      expect(hasWildcardPattern('./utils/*/index')).toBe(true)
    })

    it('should return false for non-wildcard patterns', () => {
      expect(hasWildcardPattern('./features/foo')).toBe(false)
      expect(hasWildcardPattern('./index')).toBe(false)
      expect(hasWildcardPattern('.')).toBe(false)
    })
  })

  describe('substituteWildcardInPath', () => {
    it('should replace single wildcard in path', () => {
      expect(substituteWildcardInPath('./dist/features/*.js', 'foo')).toBe(
        './dist/features/foo.js',
      )
    })

    it('should replace multiple wildcards in path', () => {
      expect(substituteWildcardInPath('./dist/*/lib/*.js', 'features')).toBe(
        './dist/features/lib/features.js',
      )
    })

    it('should handle paths without wildcards', () => {
      expect(substituteWildcardInPath('./dist/index.js', 'foo')).toBe(
        './dist/index.js',
      )
    })

    it('should handle complex paths with wildcards', () => {
      expect(
        substituteWildcardInPath('./dist/features/*/index.js', 'bar'),
      ).toBe('./dist/features/bar/index.js')
    })
  })

  describe('wildcardPatternToGlob', () => {
    it('should convert wildcard pattern to glob pattern', () => {
      const result = wildcardPatternToGlob('./features/*', '/src')
      expect(result).toBe('/src/features/*')
    })

    it('should handle patterns without leading dot-slash', () => {
      const result = wildcardPatternToGlob('features/*', '/src')
      expect(result).toBe('/src/features/*')
    })
  })

  describe('expandWildcardPattern', () => {
    const mockCwd = '/test/project'

    it('should return empty map when source directory does not exist', async () => {
      vi.mocked(existsSync).mockReturnValue(false)

      const result = await expandWildcardPattern('./features/*', mockCwd)
      expect(result.size).toBe(0)
    })

    it('should expand wildcard pattern with matching files', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['features/foo.ts', 'features/bar.ts'])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      expect(result.size).toBe(2)
      expect(result.get('./features/foo')).toBe('foo')
      expect(result.get('./features/bar')).toBe('bar')
    })

    it('should handle index files in wildcard expansion', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['features/baz/index.ts'])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      expect(result.size).toBe(1)
      expect(result.get('./features/baz')).toBe('baz')
    })

    it('should expand nested paths in wildcard expansion', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['features/nested/deep/file.ts'])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      expect(result.size).toBe(1)
      // `*` matches across `/`, matching Node's subpath pattern resolution
      expect(result.get('./features/nested/deep/file')).toBe('nested/deep/file')
    })

    it('should expand a wildcard prefixed within a segment', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['feat-alpha.ts', 'other.ts'])

      const result = await expandWildcardPattern('./feat-*', mockCwd)

      expect(result.size).toBe(1)
      expect(result.get('./feat-alpha')).toBe('alpha')
    })

    it('should expand a wildcard followed by a suffix', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue([
        'alpha/utils.ts',
        'beta/utils.ts',
        'alpha/other.ts',
      ])

      const result = await expandWildcardPattern('./*/utils', mockCwd)

      expect(result.size).toBe(2)
      expect(result.get('./alpha/utils')).toBe('alpha')
      expect(result.get('./beta/utils')).toBe('beta')
    })

    it('should not expand export-condition variants into their own exports', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue([
        'features/foo.ts',
        'features/foo.development.ts',
        'features/bar.react-server.ts',
      ])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      // `foo.development.ts` is a variant of `./features/foo`, and
      // `bar.react-server.ts` is a variant of `./features/bar`.
      expect(result.size).toBe(2)
      expect(result.get('./features/foo')).toBe('foo')
      expect(result.get('./features/bar')).toBe('bar')
      expect(result.get('./features/foo.development')).toBeUndefined()
    })

    it('should not match when the wildcard stands for nothing', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['feat-.ts'])

      const result = await expandWildcardPattern('./feat-*', mockCwd)

      expect(result.size).toBe(0)
    })

    it('should ignore private files and test files', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      // glob with ignore patterns filters out _private.ts and bar.test.ts
      // so it only returns foo.ts
      vi.mocked(glob).mockResolvedValue(['features/foo.ts'])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      // Should only include foo.ts, not _private.ts or bar.test.ts
      // (those are filtered by glob's ignore patterns)
      expect(result.size).toBe(1)
      expect(result.get('./features/foo')).toBe('foo')
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockRejectedValue(new Error('File system error'))

      const result = await expandWildcardPattern('./features/*', mockCwd)

      // Should return empty map on error
      expect(result.size).toBe(0)
    })

    it('should handle root level wildcard pattern', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['foo.ts', 'bar.ts'])

      const result = await expandWildcardPattern('./*', mockCwd)

      expect(result.size).toBe(2)
      expect(result.get('./foo')).toBe('foo')
      expect(result.get('./bar')).toBe('bar')
    })
  })
})
