import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { createJob } from '../../testing-utils'

describe('integration - stats', () => {
  const { job } = createJob({
    directory: __dirname,
    args: ['--stats'],
  })

  it('should print only the stats JSON to stdout', () => {
    expect(job.code).toBe(0)
    const stats = JSON.parse(job.stdout)
    expect(stats.status).toBe('success')
    expect(stats.exports).toEqual({
      '.': ['dist/index.cjs', 'dist/index.js'],
    })

    for (const output of stats.outputs) {
      const file = path.join(__dirname, output.file)
      expect(output.bytes).toBe(fs.statSync(file).size)
      expect(Object.keys(output.modules).sort()).toEqual([
        'src/index.js',
        'src/utils.js',
      ])
    }

    expect(stats.warnings).toEqual([
      expect.objectContaining({ code: 'EXPORT_MISSING_SOURCE' }),
    ])
    expect(stats.errors).toEqual([])
  })
})
