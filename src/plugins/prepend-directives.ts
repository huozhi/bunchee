import type { Plugin } from 'rollup'

export function prependDirectives(): Plugin {
  return {
    name: 'prependDirective',
    transform: {
      order: 'post',
      handler(code, id) {
        const moduleInfo = this.getModuleInfo(id)
        if (moduleInfo?.meta?.preserveDirectives) {
          const firstDirective = moduleInfo.meta.preserveDirectives.directives[0]
          if (firstDirective) {
            const directive = firstDirective.value
            const directiveCode = `'${directive}';`
            return directiveCode + '\n' + code
          }
        }
        return null
      }
    }
  }
}

