import { describe, it } from 'vitest'
import {
  createJob,
  assertContainFiles,
  assertFilesContent,
} from '../../testing-utils'

describe('integration exports-order', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with exports order', async () => {
    const distFiles = [
      'a.cjs',
      'a.d.cts',
      'a.d.ts',
      'a.edge-light.d.ts',
      'a.edge-light.js',
      'a.js',
      'index.cjs',
      'index.d.cts',
      'index.d.ts',
      'index.edge-light.d.ts',
      'index.edge-light.js',
      'index.js',
    ]
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'a.cjs': `const foo = 'foo';

exports.foo = foo;`,
      'a.edge-light.js': `const foo = 'foo';

export { foo };`,
      'a.js': `const foo = 'foo';

export { foo };`,
      'index.cjs': `var a_cjs = require('./a.cjs');`,
      'index.edge-light.js': `export * from './a.edge-light.js';`,
      'index.js': `export * from './a.js';`,
    })
  })
})
