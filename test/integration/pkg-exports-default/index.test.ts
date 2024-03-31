import { promises as fsp } from 'fs'
import { join } from 'path'
import { assertContainFiles, createIntegrationTest } from '../utils'

describe('integration pkg-exports-default', () => {
  it('should generate proper assets with js', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = ['index.cjs', 'index.mjs']
        await assertContainFiles(distDir, distFiles)
        const cjsFile = await fsp.readFile(join(distDir, 'index.cjs'), {
          encoding: 'utf-8',
        })
        expect(cjsFile).toContain(
          `function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }`,
        )
        expect(cjsFile).toContain(
          `Object.defineProperty(exports, '__esModule', { value: true });`,
        )
      },
    )
  })
})
