import { readFile } from 'fs/promises'
import { createIntegrationTest, existsFile } from '../../utils'

describe('integration bin/cts', () => {
  it('should work with bin as .cts extension', async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async ({ distDir }) => {
        const distFiles = [
          `${distDir}/bin/index.cjs`,
          `${distDir}/bin/index.d.cts`,
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
