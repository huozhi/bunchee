import { describe, expect, it } from 'vitest'
import {
  getFileNamesFromDirectory,
  createJob,
  getFileContents,
} from '../../testing-utils'

describe('integration - default-default-export-different-ext', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should not export esm module in cjs file', async () => {
    const distFiles = await getFileNamesFromDirectory(distDir)
    expect(distFiles).toEqual([
      'a.cjs',
      'a.d.ts',
      'a.js',
      'b.cjs',
      'b.d.ts',
      'b.js',
      'c.cjs',
    ])

    const contents = await getFileContents(distDir)
    // TODO: add to contents
    for (const file in contents) {
      if (file.includes('.d.')) {
        delete contents[file]
      }
    }
    expect(contents).toMatchInlineSnapshot(`
      {
        "a.cjs": "var b_cjs = require('./b.cjs');

      const a = 'a';

      exports.a = a;
      Object.keys(b_cjs).forEach(function (k) {
      	if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
      		enumerable: true,
      		get: function () { return b_cjs[k]; }
      	});
      });
      ",
        "a.js": "export * from './b.js';

      const a = 'a';

      export { a };
      ",
        "b.cjs": "const b = 'b';

      exports.b = b;
      ",
        "b.js": "const b = 'b';

      export { b };
      ",
        "c.cjs": "var a_cjs = require('./a.cjs');

      const c = \`c\${a_cjs.a}\`;

      exports.c = c;
      ",
      }
    `)
  })
})
