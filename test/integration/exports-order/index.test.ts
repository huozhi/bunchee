import { expect, describe, it } from 'vitest'
import {
  createJob,
  assertContainFiles,
  assertFilesContent,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'

describe('integration exports-order', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with exports order', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    const contents = await getFileContents(distDir)
    expect(files).toEqual([
      'a.cjs',
      // 'a.d.cts',
      'a.d.ts',
      'a.edge-light.d.ts',
      'a.edge-light.js',
      'a.js',
      'index.cjs',
      // 'index.d.cts',
      'index.d.ts',
      'index.edge-light.d.ts',
      'index.edge-light.js',
      'index.js',
    ])

    expect(contents['a.cjs']).toMatchInlineSnapshot(`
      "const foo = 'foo';

      exports.foo = foo;
      "
    `)
    expect(contents['a.edge-light.js']).toMatchInlineSnapshot(`
      "const foo = 'foo';

      export { foo };
      "
    `)
    expect(contents['a.js']).toMatchInlineSnapshot(`
      "const foo = 'foo';

      export { foo };
      "
    `)
    // FIXME: the cjs alias is wrong
    expect(contents['index.cjs']).toMatchInlineSnapshot(`
      "var a_edgeLight_js = require('./a.edge-light.js');



      Object.keys(a_edgeLight_js).forEach(function (k) {
      	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
      		enumerable: true,
      		get: function () { return a_edgeLight_js[k]; }
      	});
      });
      "
    `)
    expect(contents['index.edge-light.js']).toMatchInlineSnapshot(`
      "export * from './a.edge-light.js';
      "
    `)
    expect(contents['index.js']).toMatchInlineSnapshot(`
      "export * from './a.edge-light.js';
      "
    `)
  })
})
