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
        "cjs/index.d.ts": "//#region test/integration/multi-exports-ts/src/foo.d.ts
      declare const foo = "foo";
      type Foo = typeof foo;
      //#endregion
      //#region test/integration/multi-exports-ts/src/index.d.ts
      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;
      //#endregion
      export { FooIndex, fooIndex, index };",
        "cjs/index.js": "var index_js = require('../../foo/cjs/index.js');

      const index = 'index';
      const fooIndex = index_js.foo;

      exports.fooIndex = fooIndex;
      exports.index = index;
      ",
        "es/index.d.ts": "//#region test/integration/multi-exports-ts/src/foo.d.ts
      declare const foo = "foo";
      type Foo = typeof foo;
      //#endregion
      //#region test/integration/multi-exports-ts/src/index.d.ts
      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;
      //#endregion
      export { FooIndex, fooIndex, index };",
        "es/index.mjs": "import { foo } from '../../foo/es/index.mjs';

      const index = 'index';
      const fooIndex = foo;

      export { fooIndex, index };
      ",
        "index.d.ts": "//#region test/integration/multi-exports-ts/src/foo.d.ts
      declare const foo = "foo";
      type Foo = typeof foo;
      //#endregion
      //#region test/integration/multi-exports-ts/src/index.d.ts
      declare const index = "index";
      declare const fooIndex = "foo";
      type FooIndex = Foo;
      //#endregion
      export { FooIndex, fooIndex, index };",
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
        "types.d.ts": "//#region test/integration/multi-exports-ts/src/types.d.ts
      type SharedType = {
        value: string;
      };
      //#endregion
      export { SharedType };",
        "types.js": "
      ",
        "types/types.d.ts": "//#region test/integration/multi-exports-ts/src/types.d.ts
      type SharedType = {
        value: string;
      };
      //#endregion
      export { SharedType };",
        "types/types.js": "
      ",
      }
    `)
  })
})
