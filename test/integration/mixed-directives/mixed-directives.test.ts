import { describe, expect, it } from 'vitest'
import { getFileContents, createJob } from '../../testing-utils'

describe('integration - mixed-directives', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should work with js only project', async () => {
    const fileContents = await getFileContents(distDir)

    expect(fileContents).toMatchInlineSnapshot(`
      {
        "action-server-DOTFC6td.js": "'use server';
      async function action1() {
          return 'action1';
      }

      export { action1 as a };
      ",
        "client.js": "'use client';
      import { jsx } from 'react/jsx-runtime';
      import { a as action1 } from './action-server-DOTFC6td.js';

      function Page() {
          return /*#__PURE__*/ jsx("button", {
              onClick: action1,
              children: "Action 1"
          });
      }

      export { Page as default };
      ",
        "inline.js": "import { jsx } from 'react/jsx-runtime';
      import ClientComponent from 'client-component';

      // @ts-ignore externals
      function Page() {
          async function inlineAction() {
              'use server';
              return 'inline-action';
          }
          return /*#__PURE__*/ jsx(ClientComponent, {
              action: inlineAction
          });
      }

      export { Page as default };
      ",
      }
    `)
  })
})
