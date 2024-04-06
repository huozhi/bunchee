import fs from 'fs'
import path from 'path'
import { createCliTest } from '../utils'

describe('cli', () => {
  it('should generate .d.ts file on JavaScript file with --dts flag', async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./input.js', '-o', 'dist/javascript.js'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')

        expect(path.basename(distFile)).toBe('javascript.js')
        expect(path.basename(typeFile)).toBe('javascript.d.ts')
        expect(fs.existsSync(distFile)).toBe(true)
        expect(fs.existsSync(typeFile)).toBe(true)
        expect(code).toBe(0)
      },
    )
  })

  it('should generate .d.ts file on TypeScript file', async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./input.ts', '-o', 'dist/typescript.js'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')

        expect(path.basename(distFile)).toBe('typescript.js')
        expect(path.basename(typeFile)).toBe('typescript.d.ts')
        expect(fs.existsSync(distFile)).toBe(true)
        expect(fs.existsSync(typeFile)).toBe(true)
        expect(code).toBe(0)
      },
    )
  })
})
