import {
  getPathWithoutExtension,
  baseNameWithoutExtension,
  validateEntryFiles,
} from './file-path'

describe('getFirstBaseName', () => {
  it('should return first part base name without extension of file path', () => {
    expect(getPathWithoutExtension('index.js')).toBe('index')
    expect(getPathWithoutExtension('index.d.ts')).toBe('index')
    expect(getPathWithoutExtension('index')).toBe('index')
    // give few segments nested file path
    expect(getPathWithoutExtension('./foo/nested/index.js')).toBe(
      './foo/nested',
    )
    expect(getPathWithoutExtension('./foo/nested/index.d.ts')).toBe(
      './foo/nested',
    )
    expect(getPathWithoutExtension('./foo.jsx')).toBe('./foo')
  })
})

describe('baseNameWithoutExtension', () => {
  it('should return full base name without last extension of file path', () => {
    // give few segments nested file path
    expect(baseNameWithoutExtension('dist/foo/nested/index.js')).toBe('index')
    expect(
      baseNameWithoutExtension('dist/foo/nested/index.development.ts'),
    ).toBe('index.development')
    expect(
      baseNameWithoutExtension('dist/foo/nested/index.react-server.js'),
    ).toBe('index.react-server')
  })
})

describe('validateEntryFiles', () => {
  it('should throw error if there are multiple files with the same base name', () => {
    expect(() =>
      validateEntryFiles(['index.js', 'index.ts', 'index.mjs']),
    ).toThrowError('Conflicted entry files found for entries: .')
  })
  it('should not throw error if there are no multiple files with the same base name', () => {
    expect(() => validateEntryFiles(['foo/index.jsx', 'foo.ts'])).toThrowError(
      'Conflicted entry files found for entries: ./foo',
    )
  })
})
