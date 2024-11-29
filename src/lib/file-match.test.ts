import { matchFile } from './file-match'

describe('matchFile', () => {
  it('posix', () => {
    // Generate few different cases for the matchFile function
    expect(matchFile(['dist'], './dist/index.js')).toBe(true)
    expect(matchFile(['dist'], './dist/index.d.ts')).toBe(true)

    // Match file outside of the dist folder
    expect(matchFile(['dist'], './src/index.js')).toBe(false)
    expect(matchFile(['dist'], './src/index.d.ts')).toBe(false)

    // Match nested
    expect(matchFile(['dist/**/nested'], './dist/foo/nested/index.js')).toBe(
      true,
    )
    expect(matchFile(['dist/**/nested'], './dist/foo/index.js')).toBe(false)
  })

  it('windows', () => {
    // Generate few different cases for the matchFile function
    expect(matchFile(['dist'], '.\\dist\\index.js')).toBe(true)
    expect(matchFile(['dist'], '.\\dist\\index.d.ts')).toBe(true)

    // Match file outside of the dist folder
    expect(matchFile(['dist'], '.\\src\\index.js')).toBe(false)
    expect(matchFile(['dist'], '.\\src\\index.d.ts')).toBe(false)
  })
})
