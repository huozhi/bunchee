import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../../utils'
import { existsFile } from '../../../testing-utils'

describe('integration', () => {
  test(`bin/multi-path`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async () => {
        const distBinFiles = [
          `${__dirname}/fixtures/dist/bin/a.js`,
          `${__dirname}/fixtures/dist/bin/b.js`,
        ]
        const distTypeFiles = [
          `${__dirname}/fixtures/dist/bin/a.d.ts`,
          `${__dirname}/fixtures/dist/bin/b.d.ts`,
        ]
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
