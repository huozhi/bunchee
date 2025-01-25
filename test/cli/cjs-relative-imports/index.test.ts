import { expect, test } from 'vitest'
import fs from 'fs'
import { runCli } from '../../testing-utils'

test(`cli cjs-relative-imports should work properly`, async () => {
  const { code, distFile } = await runCli({
    directory: __dirname,
    args: ['index.js', '-o', 'dist/index.js'],
  })
  expect(code).toBe(0)

  const content = fs.readFileSync(distFile, { encoding: 'utf-8' })

  expect(content.includes('dot-js-dep')).toBe(true)
  expect(content.includes('dot-cjs-dep')).toBe(true)
})
