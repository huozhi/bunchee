import MagicString from 'magic-string'
import type { Plugin } from 'rollup'

export const prependShebang = (entry: string): Plugin => ({
  name: 'prependShebang',
  transform: (code: string, id: string) => {
    if (id !== entry) return
    const shebang = '#!/usr/bin/env node\n'
    if (code.startsWith(shebang)) return
    const magicString = new MagicString(code)
    magicString.prepend(shebang)
    return {
      code: magicString.toString(),
      map: magicString.generateMap({ hires: true }),
    }
  },
})
