import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { createCliTest } from '../utils'
import { deleteFile } from '../../testing-utils'

describe('cli', () => {
  const dir = __dirname
  beforeAll(async () => {
    await fsp.writeFile(
      join(dir, './package.json'),
      '{ "name": "prepare-ts-with-pkg-json", "devDependencies": { "@swc/types": "*" } }',
    )
  })
  afterAll(async () => {
    await deleteFile(join(dir, './package.json'))
  })

  it(`cli dts-bundle option should work properly`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./base.ts', '-o', 'dist/base.js', '--dts-bundle'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')
        expect(fs.existsSync(typeFile)).toBe(true)
        expect(fs.readFileSync(typeFile, 'utf-8')).toContain(
          'type ParserConfig =',
        )
        expect(code).toBe(0)
      },
    )
  })
  it(`cli dts-bundle option should not bundle dts without dts-bundle`, async () => {
    await createCliTest(
      {
        directory: __dirname,
        args: ['./base.ts', '-o', 'dist/base.js'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')
        expect(fs.existsSync(typeFile)).toBe(true)
        expect(fs.readFileSync(typeFile, 'utf-8')).toContain(
          "from '@swc/types';",
        )
        expect(code).toBe(0)
      },
    )
  })
  it(`cli dts-bundle option should not bundle dts from dependencies`, async () => {
    await fsp.writeFile(
      join(dir, './package.json'),
      '{ "name": "prepare-ts-with-pkg-json", "dependencies": { "@swc/types": "*" } }',
    )
    await createCliTest(
      {
        directory: __dirname,
        args: ['./base.ts', '-o', 'dist/base.js'],
      },
      ({ code, distFile }) => {
        const typeFile = distFile.replace('.js', '.d.ts')
        expect(fs.existsSync(typeFile)).toBe(true)
        expect(fs.readFileSync(typeFile, 'utf-8')).toContain(
          "from '@swc/types';",
        )
        expect(code).toBe(0)
      },
    )
  })
})
