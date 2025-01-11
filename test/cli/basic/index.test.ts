import fs from 'fs'
import { createCliTest } from '../../testing-utils'

describe('cli', () => {
  it(`cli basic should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '-o', 'dist/hello.bundle.js'],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        expect(code).toBe(0)
      },
    )
  })

  it(`cli format should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '-f', 'cjs', '-o', 'dist/hello.cjs'],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        expect(
          fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('exports.'),
        ).toBe(true)
        expect(code).toBe(0)
      },
    )
  })

  it(`cli compress should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '-m', '-o', 'dist/hello.bundle.min.js'],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        expect(
          fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sayHello'),
        ).toBe(false)
        expect(code).toBe(0)
      },
    )
  })

  it(`cli sourcemap should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '--sourcemap', '-o', 'dist/hello.js'],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        expect(
          fs
            .readFileSync(distFile, { encoding: 'utf-8' })
            .includes('sourceMappingURL'),
        ).toBe(true)
        expect(fs.existsSync(distFile + '.map')).toBe(true)
        expect(code).toBe(0)
      },
    )
  })

  it(`cli minified with sourcemap should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['hello.js', '-m', '--sourcemap', '-o', 'dist/hello.js'],
      },
      ({ code, distFile }) => {
        expect(fs.existsSync(distFile)).toBe(true)
        expect(
          fs
            .readFileSync(distFile, { encoding: 'utf-8' })
            .includes('sourceMappingURL'),
        ).toBe(true)
        expect(fs.existsSync(distFile + '.map')).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
