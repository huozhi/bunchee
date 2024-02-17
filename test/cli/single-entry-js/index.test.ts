import fs from 'fs'
import { createCliTest } from '../utils'

describe('cli', () => {
  it(`cli single-entry-js should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: [
          'src/index.js',
          '--external',
          '@huozhi/testing-package',
          '-o',
          'dist/index.js',
        ],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        // specifying types in package.json for js entry file won't work
        // if there's no tsconfig.json and entry file is js
        expect(fs.existsSync(distFile.replace('.js', '.d.ts'))).toBe(false)
        expect(code).toBe(0)
      },
    )
  })
})
