import type { Plugin } from 'rollup'
import MagicString from 'magic-string'

export function prependDirectives(): Plugin {
  return {
    name: 'prependDirective',
    transform: {
      order: 'post',
      handler(code, id) {
        const moduleInfo = this.getModuleInfo(id)
        if (moduleInfo?.meta?.preserveDirectives) {
          const firstDirective =
            moduleInfo.meta.preserveDirectives.directives[0]
          if (firstDirective) {
            const directive = firstDirective.value
            const directiveCode = `'${directive}';`
            // return directiveCode + '\n' + code
            const magicString = new MagicString(code)
            magicString.prepend(directiveCode + '\n')
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
