import { expect, test } from 'vitest'
import fs from 'fs'
import { runCli } from '../../testing-utils'

test(`cli es2020-target should work properly`, async () => {
  const { code, distFile } = await runCli({
    directory: __dirname,
    args: ['es2020.ts', '--target', 'es2020', '-o', 'dist/es2020.js'],
  })
  const content = fs.readFileSync(distFile, { encoding: 'utf-8' })

  expect(content.includes(`...globalThis`)).toBe(true)
  expect(content.includes(`setTimeout?.apply?.bind`)).toBe(true)
  expect(content.includes(`async function`)).toBe(true)
  expect(content.includes(`class A`)).toBe(true)
  expect(code).toBe(0)
})
