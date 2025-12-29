import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  hasWildcardPattern,
  substituteWildcardInPath,
  parseWildcardPattern,
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

  describe('parseWildcardPattern', () => {
    it('should parse simple wildcard pattern', () => {
      const result = parseWildcardPattern('./features/*')
      expect(result.basePath).toBe('./features')
      expect(result.wildcardSegment).toBe('')
    })

    it('should parse wildcard pattern with trailing segment', () => {
      const result = parseWildcardPattern('./features/*/utils')
      expect(result.basePath).toBe('./features')
      expect(result.wildcardSegment).toBe('/utils')
    })

    it('should handle root level wildcard', () => {
      const result = parseWildcardPattern('./*')
      expect(result.basePath).toBe('.')
      expect(result.wildcardSegment).toBe('')
    })

    it('should handle pattern ending with slash', () => {
      const result = parseWildcardPattern('./features/*/')
      expect(result.basePath).toBe('./features')
      expect(result.wildcardSegment).toBe('/')
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

    it('should handle nested paths in wildcard expansion', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue(['features/nested/deep/file.ts'])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      expect(result.size).toBe(1)
      // Should extract the first segment after features/
      expect(result.get('./features/nested')).toBe('nested')
    })

    it('should ignore private files and test files', async () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(utils.fileExists).mockReturnValue(true)
      vi.mocked(glob).mockResolvedValue([
        'features/foo.ts',
        'features/_private.ts',
        'features/bar.test.ts',
      ])

      const result = await expandWildcardPattern('./features/*', mockCwd)

      // Should only include foo.ts, not _private.ts or bar.test.ts
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
