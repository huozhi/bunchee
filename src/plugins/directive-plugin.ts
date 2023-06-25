import type { Plugin } from 'rollup'
import MagicString from 'magic-string'

export default function preserveDirectivePlugin(): Plugin {
  const directives: Set<string> = new Set()
  return {
    name: 'use-directive',

    transform(code, id) {
      const regex = /^(?:['"]use[^'"]+['"][^\n]*|#![^\n]*)/gm

      const replacedCode = code.replace(regex, (match) => {
        // replace double quotes with single quotes
        directives.add(match.replace(/["]/g, "'"))
        return ''
      })

      return {
        code: replacedCode,
        map: null,
      }
    },

    renderChunk(code, _, { sourcemap }) {
			if (!directives.size) return null

			const s = new MagicString(code)
			s.prepend(`${[...directives].join('\n')}\n`)

			return {
				code: s.toString(),
				map: sourcemap ? s.generateMap({ hires: true }) : null
			}
    }
  }
}
