import { readFile } from 'fs/promises'
import { createIntegrationTest } from '../../utils'
import { assertContainFiles } from '../../../testing-utils'

describe('integration', () => {
  test(`bin/single-path`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
      },
      async () => {
        const distFiles = [
          `${__dirname}/fixtures/dist/bin.js`,
          `${__dirname}/fixtures/dist/bin.d.ts`,
        ]
        await assertContainFiles(__dirname, distFiles)
        expect(await readFile(distFiles[0], 'utf-8')).toContain(
          '#!/usr/bin/env node',
        )
      },
    )
  })
})
