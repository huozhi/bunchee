import { readFile } from 'fs/promises'
import { createIntegrationTest, assertContainFiles } from '../../utils'

describe('integration', () => {
  test(`bin/single-path`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        filesToRemove: ['tsconfig.json'],
      },
      async ({ distDir }) => {
        const distFiles = [`${distDir}/bin.js`, `${distDir}/bin.d.ts`]
        await assertContainFiles(__dirname, distFiles)
        expect(await readFile(distFiles[0], 'utf-8')).toContain(
          '#!/usr/bin/env node',
        )
      },
    )
  })
})
