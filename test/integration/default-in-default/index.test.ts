import { describe, expect, it } from 'vitest'
import { readFile } from 'fs/promises'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
  existsFile,
} from '../../testing-utils'

describe('integration default-in-default', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should not export esm module in cjs file', async () => {
    const distFiles = [
      'a.cjs',
      'a.d.cts',
      'a.d.ts',
      'a.js',
      'b.cjs',
      'b.d.cts',
      'b.d.ts',
      'b.js',
    ]
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'a.cjs': `var b_cjs = require('./b.cjs');

const a = 'a';

exports.a = a;`,
      'a.js': `export * from './b.js';

const a = 'a';

export { a };`,
    })
  })
})
