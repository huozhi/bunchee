import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { runCli, stripANSIColor } from '../../testing-utils'

describe('integration swc-helpers-warning', () => {
  it('should warn when stage-3 decorators emit @swc/helpers but it is not installed', async () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bunchee-swc-helpers-warning-'),
    )

    try {
      fs.mkdirSync(path.join(tmpDir, 'src'), { recursive: true })
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify(
          {
            name: 'swc-helpers-warning',
            type: 'module',
          },
          null,
          2,
        ),
        'utf-8',
      )
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'index.js'),
        [
          'function dec() {',
          '  return function () {}',
          '}',
          '',
          'export class Foo {',
          '  @dec()',
          '  method() {}',
          '}',
          '',
        ].join('\n'),
        'utf-8',
      )

      const { stderr, distDir } = await runCli({
        directory: tmpDir,
        args: ['src/index.js', '-o', 'dist/index.js'],
      })

      const cleanStderr = stripANSIColor(stderr)
      expect(cleanStderr).toContain('Your build output imports "@swc/helpers"')
      expect(cleanStderr).toContain('pnpm add @swc/helpers')

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
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
