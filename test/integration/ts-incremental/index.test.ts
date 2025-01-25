import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import {
  assertContainFiles,
  assertFilesContent,
  createJob,
} from '../../testing-utils'
import { join } from 'path'

describe('integration - ts-incremental', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })
  it('should generate proper assets', async () => {
    const distFiles = ['index.js', 'index.d.ts']

    await assertContainFiles(distDir, distFiles)
    await assertFilesContent(distDir, {
      'index.d.ts': 'declare const _default: () => string;',
    })

    expect(existsSync(join(distDir, '.tsbuildinfo'))).toBe(false)
  })
})
