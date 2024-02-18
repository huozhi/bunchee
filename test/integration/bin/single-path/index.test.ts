import { readFile } from 'fs/promises'
import {
  createIntegrationTest,
  assertContainFiles,
  deleteFile,
} from '../../utils'

afterEach(async () => {
  await deleteFile(`${__dirname}/fixtures/tsconfig.json`)
})

describe('integration', () => {
  test(`bin/single-path`, async () => {
    await createIntegrationTest(
      {
        directory: __dirname,
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
