import { describe, expect, it } from 'vitest'
import {
  assertFilesContent,
  createJob,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration - tsconfig-override', () => {
  const { dir } = createJob({
    directory: __dirname,
  })
  it('should not generate js types paths if not specified', async () => {
    await assertFilesContent(dir, {
      './dist/subpath/nested.js': 'subpath/nested',
      './dist/subpath/nested.cjs': 'subpath/nested',
    })
    // No types files should be generated
    expect(await getFileNamesFromDirectory(dir)).toEqual([
      'dist/subpath/nested.cjs',
      'dist/subpath/nested.js',
    ])
  })
})
