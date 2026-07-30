import path from 'path'
import { describe, expect, it } from 'vitest'
import {
  getFileContents,
  getFileNamesFromDirectory,
  removeDirectory,
} from '../../testing-utils'
import { executeBunchee } from '../../testing-utils/shared'

const dir = __dirname
const distDir = path.join(dir, 'dist')
const PROFILE_PREFIX = 'BUNCHEE_PROFILE '

describe('integration - dts-program-reuse', () => {
  it('reuses a broad declaration Program for a private entry graph', async () => {
    await removeDirectory(distDir)
    const result = await executeBunchee(['--cwd', dir], {
      env: { PROFILE: '1' },
    })

    expect(result.stderr).toBe('')
    expect(result.code).toBe(0)

    const files = await getFileNamesFromDirectory(distDir)
    const contents = await getFileContents(distDir)
    expect(files).toEqual([
      '_shared.d.ts',
      '_shared.js',
      '_shared.mjs',
      'index.d.ts',
      'index.js',
      'index.mjs',
    ])
    expect(contents['_shared.d.ts']).toContain(`type Shared = {`)

    const programEvents = result.stdout
      .split('\n')
      .filter((line) => line.startsWith(PROFILE_PREFIX))
      .map((line) => JSON.parse(line.slice(PROFILE_PREFIX.length)))
      .filter((event) => event.phase === 'dts.program')

    expect(programEvents).toHaveLength(2)
    expect(programEvents.map((event) => event.details.inputs)).toEqual([2, 1])
    expect(programEvents.map((event) => event.details.reused)).toEqual([
      false,
      true,
    ])
  }, 120_000)
})
