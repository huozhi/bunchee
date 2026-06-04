import { describe, expect, it } from 'vitest'
import { getFileContents, createJob } from '../../testing-utils'

describe('integration esm-shims', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with ESM shims', async () => {
    const contents = await getFileContents(distDir, [
      'custom-require.js',
      'custom-require.mjs',
      'dirname.js',
      'dirname.mjs',
      'filename.js',
      'filename.mjs',
      'require.js',
      'require.mjs',
    ])

    expect(contents).toMatchInlineSnapshot(`
      {
        "custom-require.js": "const a = 1;

      exports.a = a;
      ",
        "custom-require.mjs": "const a = 1;

      export { a };
      ",
        "dirname.js": "function getDirname() {
          return __dirname;
      }

      exports.getDirname = getDirname;
      ",
        "dirname.mjs": "import __node_cjsUrl from 'node:url';
      import __node_cjsPath from 'node:path';

      function getDirname() {
          return __dirname$1;
      }
      const __filename$1 = __node_cjsUrl.fileURLToPath(import.meta.url);
      const __dirname$1 = __node_cjsPath.dirname(__filename$1);

      export { getDirname };
      ",
        "filename.js": "function getFilename() {
          return __filename;
      }

      exports.getFilename = getFilename;
      ",
        "filename.mjs": "import __node_cjsUrl from 'node:url';

      function getFilename() {
          return __filename$1;
      }

      const __filename$1 = __node_cjsUrl.fileURLToPath(import.meta.url);

      export { getFilename };
      ",
        "require.js": "var require$$0 = require('node:fs');

      var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
      function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

      var require$$0__default = /*#__PURE__*/_interopDefault(require$$0);

      function getRequireModule() {
          return require$$0__default.default;
      }
      function esmImport() {
          return (typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('require.js', document.baseURI).href));
      }

      exports.esmImport = esmImport;
      exports.getRequireModule = getRequireModule;
      ",
        "require.mjs": "import require$$0 from 'node:fs';

      function getRequireModule() {
          return require$$0;
      }
      function esmImport() {
          return import.meta.url;
      }

      export { esmImport, getRequireModule };
      ",
      }
    `)
  })
})
