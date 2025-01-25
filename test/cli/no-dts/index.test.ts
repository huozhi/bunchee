import { expect, test } from 'vitest'
import fs from 'fs'
import path from 'path'
import { runCli } from '../../testing-utils'

test(`cli no-dts option should work properly`, async () => {
  const { code, distFile } = await runCli({
    directory: __dirname,
    args: ['./base.ts', '-o', 'dist/base.js', '--no-dts'],
  })
  const typeFile = distFile.replace('.js', '.d.ts')

  expect(path.basename(distFile)).toBe('base.js')
  expect(fs.existsSync(distFile)).toBe(true)
  expect(fs.existsSync(typeFile)).toBe(false)
  expect(code).toBe(0)
})
