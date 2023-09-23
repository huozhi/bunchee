import type { Plugin } from 'rollup'
import { type FilterPattern, createFilter } from '@rollup/pluginutils'

function minifyCSS(content: string) {
  return content.replace(
    /\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$|(?:^|\s)(\s+)|\s*([\{\};,:])\s*|\s+(!)\s+/g,
    (match, p1, p2, p3, p4) => {
      if (p1) return p1 === ' ' ? '' : p1
      if (p2) return ' '
      if (p3) return p3
      if (p4) return '!'
    },
  )
}

// have to assign r.type = 'text/css' to make it work in Safari
const insertCodeJs = `\
function __insertCSS(code) {
  if (!code || typeof document == 'undefined') return
  let head = document.head || document.getElementsByTagName('head')[0]
  style = document.createElement('style')
  style.type = 'text/css'
  head.appendChild(style)
  ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
}
`

export function inlineCss(options: { skip?: boolean, exclude?: FilterPattern }): Plugin {
  const filter = createFilter(['**/*.css'], options.exclude ?? [])

  return {
    name: 'inline-css',
    transform(code, id) {
      if (!filter(id)) return

      if (options.skip) return ''

      const cssCode = minifyCSS(code)

      const moduleInfo = this.getModuleInfo(id)
      if (moduleInfo?.assertions?.type === 'css') {
        return {
          code: `const sheet = new CSSStyleSheet()sheet.replaceSync(${JSON.stringify(
            cssCode,
          )})\nexport default sheet`,
          map: { mappings: '' },
        }
      }

      return {
        code: `${insertCodeJs}__insertCSS(${JSON.stringify(cssCode)})`,
        map: { mappings: '' },
      }
    },
  }
}
