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
    args: ['--external', '@swc/helpers'],
  })

  it('should warn when output references @swc/helpers but it is not declared', async () => {
    const stderr = stripANSIColor(job.stderr)
    expect(stderr).toContain('Your build output imports "@swc/helpers"')
    expect(stderr).toContain('pnpm add @swc/helpers')

    assertContainFiles(distDir, ['index.js'])

    const output = fs.readFileSync(path.join(distDir, 'index.js'), 'utf-8')
    expect(output).toMatchInlineSnapshot(`
      "import { _ } from '@swc/helpers/_/_async_to_generator';
      import { _ as _$1 } from '@swc/helpers/_/_extends';
      
      function makeObject(value) {
          return _(function*() {
              yield Promise.resolve();
              return _$1({
                  value
              }, value ? {
                  extra: true
              } : {});
          })();
      }
      
      export { makeObject };
      "
    `)
  })
})
