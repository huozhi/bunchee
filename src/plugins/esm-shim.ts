// @ts-expect-error @rollup/plugin-esm-shim has this export but missing in the types
import { provideCJSSyntax } from '@rollup/plugin-esm-shim'
import { availableExtensions } from '../constants'
import { Plugin } from 'rollup'
import { extname } from 'path'

export function esmShim(): Plugin {
  return {
    name: 'esm-shim',
    renderChunk: {
      order: 'pre',
      handler(code, chunk, opts) {
        const chunkExt = extname(chunk.fileName).slice(1)
        if (chunk.type === 'chunk' && availableExtensions.has(chunkExt)) {
          return
        }
        if (opts.format === 'es') {
          return provideCJSSyntax(code)
        }
        return
      },
    },
  }
}
