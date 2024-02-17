import fs from 'fs'
import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli cjs-relative-imports should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['index.js', '-o', 'dist/index.js'],
      },
      ({ code, distFile }) => {
        expect(code).toBe(0)

        const content = fs.readFileSync(distFile, { encoding: 'utf-8' })

        expect(content.includes('dot-js-dep')).toBe(true)
        expect(content.includes('dot-cjs-dep')).toBe(true)
      },
    )
  })
})
