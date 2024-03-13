import * as fsp from 'fs/promises'
import { join } from 'path'
import { createIntegrationTest } from '../utils'

describe('integration tsconfig-override', () => {
  it('should use es5 output in build without override', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ dir }) => {
        const content = await fsp.readFile(
          join(dir, './dist/index.js'),
          'utf-8',
        )
        expect(content).toContain('function A')
        expect(content).not.toContain('class A')
      },
    )
  })
  it('should use es8 output in build', async () => {
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
        expect(content).not.toContain('function A')
        expect(content).toContain('class A')
      },
    )
  })
})
