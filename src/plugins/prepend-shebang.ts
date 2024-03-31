import fs from 'fs'
import MagicString from 'magic-string'
import path from 'path'
import type { OutputChunk, Plugin, SourceMapInput } from 'rollup'

export const prependShebang = (executablePaths: string[]): Plugin => ({
  name: 'patchBinary',

  renderChunk: (code, chunk, outputOptions) => {
    if (
      !chunk.isEntry ||
      !chunk.facadeModuleId ||
      code.startsWith('#!/usr/bin/env node\n')
    ) {
      return
    }

    const entryFileNames =
      typeof outputOptions.entryFileNames === 'function'
        ? outputOptions.entryFileNames(chunk)
        : outputOptions.entryFileNames
    const outputPath = path.resolve(outputOptions.dir!, entryFileNames)

    if (!executablePaths.includes(outputPath)) {
      return
    }
    const transformed = new MagicString(code)
    transformed.prepend('#!/usr/bin/env node\n')

    return {
      code: transformed.toString(),
      map: outputOptions.sourcemap
        ? (transformed.generateMap({ hires: true }) as SourceMapInput)
        : undefined,
    }
  },

  writeBundle: async (outputOptions, bundle) => {
    const chmodFiles = Object.values(bundle).map(async (chunk) => {
      const outputChunk = chunk as OutputChunk
      const entryFileNames =
        typeof outputOptions.entryFileNames === 'function'
          ? outputOptions.entryFileNames(outputChunk)
          : outputOptions.entryFileNames

      if (outputChunk.isEntry && outputChunk.facadeModuleId) {
        const outputPath = path.resolve(outputOptions.dir!, entryFileNames)
        await fs.promises.chmod(outputPath, 0o755)
      }
    })

    await Promise.all(chmodFiles)
  },
})
