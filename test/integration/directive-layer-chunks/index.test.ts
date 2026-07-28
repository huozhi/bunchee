import { describe, expect, it } from 'vitest'
import {
  createJob,
  getFileContents,
  getFileNamesFromDirectory,
} from '../../testing-utils'

// `src/x/util.ts` carries `'use cache'` and `src/y/util.ts` carries
// `'use server'`. They share a file name, so the only thing keeping them apart
// is the layer in their chunk group key — and that key used to be a hash short
// enough to fit in a file name, under which `cache` and `server` collided. Both
// modules then landed in one chunk with both directives stacked on top, which
// is not a boundary either of them asked for.
describe('integration - directive-layer-chunks', () => {
  const { distDir } = createJob({ directory: __dirname })

  it('should not merge two layers into one chunk', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    const contents = await getFileContents(distDir)

    const chunks = files.filter(
      (file) => file.startsWith('util-') && file.endsWith('.js'),
    )
    expect(chunks).toHaveLength(2)

    // Each chunk carries exactly one directive, and between them they cover
    // both layers.
    const directives = chunks.map((chunk) =>
      [...contents[chunk].matchAll(/^'use ([a-z]+)';$/gm)].map((m) => m[1]),
    )
    expect(directives.map((d) => d.length)).toEqual([1, 1])
    expect(directives.flat().sort()).toEqual(['cache', 'server'])

    // And the two layers' code did not end up in the same file.
    const cacheChunk = chunks.find((chunk) =>
      contents[chunk].includes('cache-value'),
    )
    const serverChunk = chunks.find((chunk) =>
      contents[chunk].includes('server-value'),
    )
    expect(cacheChunk).toBeDefined()
    expect(serverChunk).toBeDefined()
    expect(cacheChunk).not.toBe(serverChunk)
  })

  it('should name boundary chunks <module>-<hash> with an alphanumeric hash', async () => {
    const files = await getFileNamesFromDirectory(distDir)
    const chunks = files.filter(
      (file) => file.startsWith('util-') && file.endsWith('.js'),
    )

    for (const chunk of chunks) {
      // One dash, and the layer is not spelled into the name. base36 hashes
      // keep the hash itself from contributing any more dashes.
      expect(chunk).toMatch(/^util-[0-9a-z]+\.js$/)
    }
  })
})
