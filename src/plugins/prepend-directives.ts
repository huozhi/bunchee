import type { Plugin } from 'rollup'
import type { PreserveDirectiveMeta } from 'rollup-preserve-directives'

export function prependDirectives(): Plugin {
  return {
    name: 'prependDirective',
    transform: {
      order: 'post',
      handler(code, id) {
        const moduleInfo = this.getModuleInfo(id)
        const preserveDirectives: PreserveDirectiveMeta =
          moduleInfo?.meta?.preserveDirectives
        if (preserveDirectives) {
          const firstDirective = preserveDirectives.directives[0]
          if (firstDirective) {
            const directive = firstDirective
            const directiveCode = `'${directive}';`
            return directiveCode + '\n' + code
          }
        }
        return null
      },
    },
  }
}
