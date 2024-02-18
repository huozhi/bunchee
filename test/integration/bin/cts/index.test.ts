import { readFile } from 'fs/promises'
import { createIntegrationTest, existsFile } from '../../utils'

describe('integration', () => {
  test(`bin/cts`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
        filesToRemove: ['tsconfig.json'],
      },
      async () => {
        const distFiles = [
          `${__dirname}/fixtures/dist/bin/index.cjs`,
          `${__dirname}/fixtures/dist/bin/index.d.cts`,
        ]

        for (const distFile of distFiles) {
          expect(await existsFile(distFile)).toBe(true)
        }

        expect(await readFile(distFiles[0], 'utf-8')).toContain(
          '#!/usr/bin/env node',
        )
      },
    )
  })
})
