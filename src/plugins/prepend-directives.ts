import type { Plugin } from 'rollup'
import MagicString from 'magic-string'
import { type PreserveDirectiveMeta } from 'rollup-preserve-directives'

export function prependDirectives(): Plugin {
  return {
    name: 'prepend-directive',
    transform: {
      order: 'post',
      handler(code, id) {
        const moduleInfo = this.getModuleInfo(id)
        const metadata: PreserveDirectiveMeta | undefined =
          moduleInfo?.meta?.preserveDirectives
        if (metadata) {
          const directive = metadata.directives[0]
          if (directive) {
            const magicString = new MagicString(code)
            magicString.prepend(`'${directive}';\n`)
            return {
              code: magicString.toString(),
              map: magicString.generateMap({ hires: true }),
            }
          }
        }
        return null
      },
    },
  }
}
