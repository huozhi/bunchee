import { describe, expect, it } from 'vitest'
import { createJob, getFileContents } from '../../testing-utils'

describe('integration multi-exports', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work with multi exports condition', async () => {
    const contents = await getFileContents(distDir)
    expect(contents).toMatchInlineSnapshot(`
      {
        "cjs/index.d.cts": "import { Foo } from '../../foo/cjs/index.cjs';

      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;

      export { fooIndex, index };
      export type { FooIndex };
      ",
        "cjs/index.js": "var index_js = require('../../foo/cjs/index.js');

      const index = 'index';
      const fooIndex = index_js.foo;

      exports.fooIndex = fooIndex;
      exports.index = index;
      ",
        "es/index.d.mts": "import { Foo } from '../../foo/es/index.mjs';

      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;

      export { fooIndex, index };
      export type { FooIndex };
      ",
        "es/index.mjs": "import { foo } from '../../foo/es/index.mjs';

      const index = 'index';
      const fooIndex = foo;

      export { fooIndex, index };
      ",
        "index.d.cts": "import { Foo } from '../../foo/cjs/index.cjs';

      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;

      export { fooIndex, index };
      export type { FooIndex };
      ",
        "index.d.mts": "import { Foo } from '../../foo/es/index.mjs';

      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;

      export { fooIndex, index };
      export type { FooIndex };
      ",
        "index.js": "var index_js = require('../../foo/cjs/index.js');

      const index = 'index';
      const fooIndex = index_js.foo;

      exports.fooIndex = fooIndex;
      exports.index = index;
      ",
        "index.mjs": "import { foo } from '../../foo/es/index.mjs';

      const index = 'index';
      const fooIndex = foo;

      export { fooIndex, index };
      ",
        "types.d.ts": "type SharedType = {
          value: string;
      };

      export type { SharedType };
      ",
        "types.js": "
      ",
        "types/types.d.ts": "type SharedType = {
          value: string;
      };

      export type { SharedType };
      ",
        "types/types.js": "
      ",
      }
    `)
  })
})
