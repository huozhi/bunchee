import { promises as fsp } from 'fs'
import { createIntegrationTest } from '../utils'
import path from 'path'

describe('integration shared-module-ts-esm', () => {
  it('should contain correct type file path of shared chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const cjsFiles = await fsp.readdir(path.join(distDir, 'cjs'))
        const esmFiles = await fsp.readdir(path.join(distDir, 'es'))

        expect(cjsFiles).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/util-shared-\w+\.js/),
          ]),
        )

        expect(esmFiles).toEqual(
          expect.arrayContaining([
            expect.stringMatching(/util-shared-\w+\.mjs/),
          ]),
        )
      },
    )
  })
})
