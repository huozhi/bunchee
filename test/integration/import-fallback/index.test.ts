import { describe, expect, it } from 'vitest'
import { readFile } from 'fs/promises'
import { createJob } from '../../testing-utils'

describe('integration import fallback', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should handle import fallback', async () => {
    const aEdgeLightFile = `${distDir}/a.edge-light.js`
    const content = await readFile(aEdgeLightFile, { encoding: 'utf-8' })
    expect(content).toMatch(/import '.\/b.js'/)
  })
})
