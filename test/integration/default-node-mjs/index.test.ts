import { readFile } from 'fs/promises'
import { createJob, existsFile } from '../../testing-utils'

describe('integration default-node-mjs', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should work with .mjs extension', async () => {
    const distFiles = [`${distDir}/index.node.mjs`]

    for (const f of distFiles) {
      expect(await existsFile(f)).toBe(true)
    }

    expect(await readFile(distFiles[0], 'utf-8')).toContain('export {')
    expect(await readFile(distFiles[0], 'utf-8')).not.toContain('exports')
  })
})
