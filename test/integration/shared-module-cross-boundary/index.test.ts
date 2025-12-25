import { describe, expect, it } from 'vitest'
import {
  createJob,
  getFileNamesFromDirectory,
  getFileContents,
} from '../../testing-utils'

describe('integration - shared-module-cross-boundary', () => {
  const { distDir } = createJob({
    directory: __dirname,
  })

  it('should split shared module into separate chunk when imported by both client and server', async () => {
    const jsFiles = await getFileNamesFromDirectory(distDir)

    // Verify that a shared chunk is created for the cross-boundary shared module
    // The shared module should NOT be inlined into either client or server chunks
    // The chunk name pattern is: shared-{hash}.js (where hash is based on the layers)
    const crossBoundarySharedChunks = jsFiles.filter(
      (f) =>
        f.startsWith('shared-') &&
        !f.includes('client') &&
        !f.includes('server') &&
        f.endsWith('.js'),
    )

    // There should be exactly one cross-boundary shared chunk created
    expect(crossBoundarySharedChunks.length).toBe(1)

    // Verify the main entry file exists
    expect(jsFiles).toContain('index.js')

    // Verify client and server chunks exist
    const clientChunks = jsFiles.filter(
      (f) =>
        (f.includes('client-') || f.includes('client2-')) && f.endsWith('.js'),
    )
    const serverChunks = jsFiles.filter(
      (f) => f.includes('server-') && f.endsWith('.js'),
    )
    expect(clientChunks.length).toBe(2) // client and client2
    expect(serverChunks.length).toBe(1)
  })

  it('should have client and server chunks import from the cross-boundary shared chunk', async () => {
    const fileContents = await getFileContents(distDir)

    // Find the cross-boundary shared chunk filename (shared between client and server)
    const crossBoundarySharedChunk = Object.keys(fileContents).find(
      (f) =>
        f.startsWith('shared-') &&
        !f.includes('client') &&
        !f.includes('server') &&
        f.endsWith('.js') &&
        !f.endsWith('.d.ts'),
    )

    expect(crossBoundarySharedChunk).toBeDefined()

    // The cross-boundary shared chunk should contain the shared utilities
    const sharedContent = fileContents[crossBoundarySharedChunk!]
    expect(sharedContent).toContain('shared-util-value')
    expect(sharedContent).toContain('shared-constant')

    // The shared chunk should NOT have any directive
    expect(sharedContent).not.toMatch(/^['"]use (client|server)['"]/m)

    // Find client and server boundary chunks
    const clientChunk = Object.keys(fileContents).find(
      (f) =>
        f.includes('client-') &&
        !f.includes('client2') &&
        !f.includes('client-only') &&
        f.endsWith('.js') &&
        !f.endsWith('.d.ts'),
    )
    const serverChunk = Object.keys(fileContents).find(
      (f) => f.includes('server-') && f.endsWith('.js') && !f.endsWith('.d.ts'),
    )

    expect(clientChunk).toBeDefined()
    expect(serverChunk).toBeDefined()

    // Client chunk should import from the cross-boundary shared chunk
    expect(fileContents[clientChunk!]).toContain(crossBoundarySharedChunk!)
    expect(fileContents[clientChunk!]).toContain("'use client'")
    // Client chunk should NOT contain the cross-boundary shared utilities directly
    expect(fileContents[clientChunk!]).not.toContain('shared-util-value')

    // Server chunk should import from the cross-boundary shared chunk
    expect(fileContents[serverChunk!]).toContain(crossBoundarySharedChunk!)
    expect(fileContents[serverChunk!]).toContain("'use server'")
    // Server chunk should NOT contain the shared utilities directly
    expect(fileContents[serverChunk!]).not.toContain('shared-util-value')
  })

  it('should NOT have server chunk importing from client chunk', async () => {
    const fileContents = await getFileContents(distDir)

    // Find client and server boundary chunks
    const clientChunks = Object.keys(fileContents).filter(
      (f) =>
        (f.includes('client-') || f.includes('client2-')) &&
        f.endsWith('.js') &&
        !f.endsWith('.d.ts'),
    )
    const serverChunk = Object.keys(fileContents).find(
      (f) => f.includes('server-') && f.endsWith('.js') && !f.endsWith('.d.ts'),
    )

    expect(clientChunks.length).toBeGreaterThan(0)
    expect(serverChunk).toBeDefined()

    // Server chunk should NOT import from any client chunk (the original bug)
    // It should only import from the shared chunk
    for (const clientChunk of clientChunks) {
      expect(fileContents[serverChunk!]).not.toContain(clientChunk)
    }
  })

  it('should allow same-layer client modules to share code without cross-boundary issues', async () => {
    const fileContents = await getFileContents(distDir)
    const jsFiles = Object.keys(fileContents).filter(
      (f) => f.endsWith('.js') && !f.endsWith('.d.ts'),
    )

    // Find client chunks
    const clientChunk = jsFiles.find(
      (f) =>
        f.includes('client-') &&
        !f.includes('client2') &&
        !f.includes('client-only'),
    )
    const client2Chunk = jsFiles.find((f) => f.includes('client2-'))

    expect(clientChunk).toBeDefined()
    expect(client2Chunk).toBeDefined()

    // The client-only shared module is shared between two 'use client' modules.
    // Since they're in the SAME layer, Rollup may inline the shared code into one
    // client chunk and have the other import from it - this is valid because
    // there's no boundary crossing (both are client layer).

    // Check that the client-only-shared utility exists in the bundle
    const allClientContent =
      fileContents[clientChunk!] + fileContents[client2Chunk!]
    expect(allClientContent).toContain('client-only-shared-util')

    // One of the client chunks contains the inlined code,
    // the other imports from it - this is the correct Rollup behavior
    // for same-layer shared modules
    const clientHasInlined = fileContents[clientChunk!].includes(
      'client-only-shared-util',
    )
    const client2HasInlined = fileContents[client2Chunk!].includes(
      'client-only-shared-util',
    )

    // Exactly one should have it inlined (not both, due to Rollup optimization)
    expect(clientHasInlined).not.toEqual(client2HasInlined)

    // The one without inlined code should import from the other
    if (!clientHasInlined) {
      expect(fileContents[clientChunk!]).toContain(client2Chunk!)
    } else {
      expect(fileContents[client2Chunk!]).toContain(clientChunk!)
    }

    // Both client chunks should still have the 'use client' directive
    expect(fileContents[clientChunk!]).toContain("'use client'")
    expect(fileContents[client2Chunk!]).toContain("'use client'")

    // IMPORTANT: Server chunk should NOT import from any client chunk
    // This is the key difference - cross-boundary shared modules get split,
    // but same-layer shared modules can safely share code between chunks
    const serverChunk = jsFiles.find((f) => f.includes('server-'))
    expect(serverChunk).toBeDefined()
    expect(fileContents[serverChunk!]).not.toContain(clientChunk!)
    expect(fileContents[serverChunk!]).not.toContain(client2Chunk!)
  })
})
