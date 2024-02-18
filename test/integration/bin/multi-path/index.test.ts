import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../../utils'
import { existsFile } from '../../../testing-utils'

describe('integration', () => {
  test(`bin/multi-path`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        filesToRemove: ['tsconfig.json'],
      },
      async ({ distDir }) => {
        const distBinFiles = [`${distDir}/bin/a.js`, `${distDir}/bin/b.js`]
        const distTypeFiles = [`${distDir}/bin/a.d.ts`, `${distDir}/bin/b.d.ts`]
        const distFiles = distBinFiles.concat(distTypeFiles)

        for (const distFile of distFiles) {
          expect(await existsFile(distFile)).toBe(true)
        }
        for (const distScriptFile of distBinFiles) {
          expect(await readFile(distScriptFile, 'utf-8')).toContain(
            '#!/usr/bin/env node',
          )
        }
      },
    )
  })
})