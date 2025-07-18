import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import fsp from 'fs/promises'
import { join } from 'path'
import { runCli, deleteFile } from '../../testing-utils'

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
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['./base.ts', '-o', 'dist/base.js', '--dts-bundle'],
    })
    const typeFile = distFile.replace('.js', '.d.ts')
    expect(fs.existsSync(typeFile)).toBe(true)
    expect(fs.readFileSync(typeFile, 'utf-8')).toContain('type ParserConfig =')
    expect(code).toBe(0)
  })

  it(`cli dts-bundle option should not bundle dts without dts-bundle`, async () => {
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['./base.ts', '-o', 'dist/base.js'],
    })
    const typeFile = distFile.replace('.js', '.d.ts')
    expect(fs.existsSync(typeFile)).toBe(true)
    expect(fs.readFileSync(typeFile, 'utf-8')).toContain(`from "@swc/types";`)
    expect(code).toBe(0)
  })

  it(`cli dts-bundle option should not bundle dts from dependencies`, async () => {
    await fsp.writeFile(
      join(dir, './package.json'),
      '{ "name": "prepare-ts-with-pkg-json", "dependencies": { "@swc/types": "*" } }',
    )
    const { code, distFile } = await runCli({
      directory: __dirname,
      args: ['./base.ts', '-o', 'dist/base.js'],
    })
    const typeFile = distFile.replace('.js', '.d.ts')
    expect(fs.existsSync(typeFile)).toBe(true)
    expect(fs.readFileSync(typeFile, 'utf-8')).toContain(`from "@swc/types";`)
    expect(code).toBe(0)
  })
})
