import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import { runCli } from '../../testing-utils'

describe('cli', () => {
  afterEach(() => {
    // remove dist folder
    fs.rmdirSync(__dirname + '/dist', { recursive: true })
  })

  it(`cli basic should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '-o', 'dist/hello.bundle.js'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(code).toBe(0)
  })

  it(`cli format should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '-f', 'cjs', '-o', 'dist/hello.cjs'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(
      fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('exports.'),
    ).toBe(true)
    expect(code).toBe(0)
  })

  it(`cli compress should work properly`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '-m', '-o', 'dist/hello.bundle.min.js'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(
      fs.readFileSync(distFile, { encoding: 'utf-8' }).includes('sayHello'),
    ).toBe(false)
    expect(code).toBe(0)
  })

  it(`should output sourcemap when specify sourcemap option`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '--sourcemap', '-o', 'dist/hello.js'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(
      fs
        .readFileSync(distFile, { encoding: 'utf-8' })
        .includes('sourceMappingURL'),
    ).toBe(true)
    expect(fs.existsSync(distFile + '.map')).toBe(true)
    expect(code).toBe(0)
  })

  it(`should enable sourcemap when enable minify by default`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '-m', '--sourcemap', '-o', 'dist/hello.js'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(fs.existsSync(distFile + '.map')).toBe(true)
    expect(
      fs
        .readFileSync(distFile, { encoding: 'utf-8' })
        .includes('sourceMappingURL'),
    ).toBe(true)
    expect(code).toBe(0)
  })

  it(`should be able to opt out sourcemap when minify`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['hello.js', '-m', '--no-sourcemap', '-o', 'dist/hello.js'],
    })
    expect(fs.existsSync(distFile)).toBe(true)
    expect(fs.existsSync(distFile + '.map')).toBe(false)
    expect(code).toBe(0)
  })
})
