import MagicString from 'magic-string'
import type { Plugin } from 'rollup'

const SHEBANG = '#!/usr/bin/env node\n'

/**
 * Prepends a shebang to the bin entries' own modules.
 *
 * A merged build holds several entries at once, so the plugin takes every bin
 * source rather than the single one being built.
 */
export const prependShebang = (entries: string | Set<string>): Plugin => {
  const binSources = typeof entries === 'string' ? new Set([entries]) : entries
  return {
    name: 'prependShebang',
    transform: (code: string, id: string) => {
      if (!binSources.has(id)) return
      if (code.startsWith(SHEBANG)) return
      const magicString = new MagicString(code)
      magicString.prepend(SHEBANG)
      return {
        code: magicString.toString(),
        map: magicString.generateMap({ hires: true }),
      }
    },
  }
}
