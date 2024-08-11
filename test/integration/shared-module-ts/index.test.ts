import { readFileSync, promises as fsp } from 'fs'
import { createIntegrationTest } from '../utils'
import path from 'path'

describe('integration shared-module-ts', () => {
  it('should contain correct type file path of shared chunks', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const files = await fsp.readdir(distDir)
        const sharedUtilModuleFile = files.find((file) =>
          /util-shared-\w+\.d\.ts/.test(file),
        )!
        const appContextSharedFile = files.find((file) =>
          /app-context-shared-\w+\.d\.ts/.test(file),
        )!

        const indexType = files.find((file) => file === 'index.d.ts')!
        const indexFileContent = readFileSync(
          path.join(distDir, indexType),
          'utf-8',
        )

        expect(indexFileContent).toContain(
          sharedUtilModuleFile.replace('.d.ts', '.js'),
        )
        expect(indexFileContent).toContain(
          appContextSharedFile.replace('.d.ts', '.js'),
        )
      },
    )
  })
})
