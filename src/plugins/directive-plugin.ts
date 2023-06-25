import type { Plugin } from 'rollup'
import MagicString from 'magic-string'



export default function preserveDirectivePlugin(): Plugin {
  const fileDirectivesMap = new Map()
  return {
    name: 'use-directive',

    transform(code, id) {
      const regex = /^(?:['"]use[^'"]+['"][^\n]*|#![^\n]*)/gm
      const directives: Set<string> = new Set()

      const replacedCode = code.replace(regex, (match) => {
        // replace double quotes with single quotes
        directives.add(match.replace(/["]/g, "'"))
        return ''
      })

      if (directives.size) fileDirectivesMap.set(id, directives)
      return {
        code: replacedCode,
        map: null,
      }
    },

    renderChunk(code, chunk, { sourcemap }) {
      let directives = fileDirectivesMap.get(chunk.facadeModuleId)
			if (!directives) return null

			const s = new MagicString(code)
			s.prepend(`${[...directives].join('\n')}\n`)

			return {
				code: s.toString(),
				map: sourcemap ? s.generateMap({ hires: true }) : null
			}
    }
  }
}
