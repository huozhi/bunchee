import fsp from 'fs/promises'
import { join } from 'path'
import { execSync } from 'child_process'
import {
  assertContainFiles,
  assertFilesContent,
  createIntegration,
} from '../utils'
import { existsSync } from 'fs'

describe('integration - no-clean flag', () => {
  const distDir = join(__dirname, 'dist')
  beforeAll(async () => {
    execSync(`rm -rf ${distDir}`)
    await fsp.mkdir(distDir)
    await fsp.writeFile(join(distDir, 'no-clean.json'), '{}')
  })

  createIntegration({
    directory: __dirname,
    args: ['--no-clean'],
  })

  it('should not clean dist with --no-clean flag', async () => {
    const distFiles = ['index.js', 'index.d.ts']
    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.d.ts': 'declare const _default: () => string;',
    })

    await assertContainFiles(distDir, distFiles.concat(['no-clean.json']))
  })
})

describe('integration - no-clean default', () => {
  const distDir = join(__dirname, 'dist')

  beforeAll(async () => {
    execSync(`rm -rf ${distDir}`)
    await fsp.mkdir(distDir)
    await fsp.writeFile(join(distDir, 'no-clean.json'), '{}')
  })

  createIntegration({
    directory: __dirname,
  })

  it('should clean dist by default', async () => {
    expect(existsSync(join(distDir, 'no-clean.json'))).toBe(false)
    expect(existsSync(join(distDir, 'index.js'))).toBe(true)
  })
})
