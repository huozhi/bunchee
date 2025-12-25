import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  createJob,
  assertContainFiles,
  stripANSIColor,
} from '../../testing-utils'

describe('integration swc-helpers-warning', () => {
  const { job, distDir } = createJob({
    directory: __dirname,
  })

  it('should warn when output references @swc/helpers but it is not installed', async () => {
    const stderr = stripANSIColor(job.stderr)
    expect(stderr).toContain('Your build output imports "@swc/helpers"')
    expect(stderr).toContain('pnpm add @swc/helpers')

    assertContainFiles(distDir, ['index.js'])

    const output = fs.readFileSync(path.join(distDir, 'index.js'), 'utf-8')
    expect(output).toMatchInlineSnapshot(`
      "import { _ } from '@swc/helpers/_/_apply_decs_2203_r';
      
      var _dec, _initProto;
      function dec() {
          return function() {};
      }
      _dec = dec();
      class Foo {
          method() {}
          constructor(){
              _initProto(this);
          }
      }
      ({ e: [_initProto] } = _(Foo, [
          [
              _dec,
              2,
              "method"
          ]
      ], []));
      
      export { Foo };
      "
    `)
  })
})
