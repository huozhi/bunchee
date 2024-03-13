import * as fsp from 'fs/promises'
import { join } from 'path'
import { createIntegrationTest } from '../utils'

describe('integration tsconfig-override', () => {
  it('should use esnext output in build without override', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const content = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(content).toContain("var index = (()=>'index');")
      },
    )
  })
  it('should use es5 output in build', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        args: ['--tsconfig', 'tsconfig.build.json'],
      },
      async ({ dir }) => {
        const content = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(content).toContain('export { index as default };')
      },
    )
  })
})
