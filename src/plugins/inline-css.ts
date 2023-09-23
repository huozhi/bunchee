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

const helpers = {
  cssImport: {
    // have to assign r.type = 'text/css' to make it work in Safari
    global: `\
function __insertCSS(code) {
  if (!code || typeof document == 'undefined') return
  let head = document.head || document.getElementsByTagName('head')[0]
  style = document.createElement('style')
  style.type = 'text/css'
  head.appendChild(style)
  ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
}
`,
    create(code: string) {
      return `__insertCSS(${JSON.stringify(code)});`
    }
  },
  cssAssertionImport: {
    global: '',
    create(code: string) {
      return `\
const sheet = new CSSStyleSheet()
sheet.replaceSync(${JSON.stringify(code)})
export default sheet`
    }
  }
} as const

export function inlineCss(options: { skip?: boolean, exclude?: FilterPattern }): Plugin {
  const filter = createFilter(['**/*.css'], options.exclude ?? [])
  const cssTypeSet = new Set<
    | 'cssImport'
    // wait for rollup 4 for better support of assertion support https://github.com/rollup/rollup/issues/4818
    // | 'cssAssertionImport'
  >()

  return {
    name: 'inline-css',
    transform(code, id) {
      if (!filter(id)) return
      if (options.skip) return ''
      const cssCode = minifyCSS(code)

      return {
        code: helpers.cssImport.create(cssCode),
        map: { mappings: '' },
      }
    },
    renderChunk(code) {
      if (cssTypeSet.size === 0) return null

      let prefix = ''
      for (const cssType of cssTypeSet) {
        const cssHelper = helpers[cssType]
        prefix = `${cssHelper.global};\n${prefix}`
      }

      return {
        code: `${prefix}${code}`,
        map: { mappings: '' },
      }
    }
  }
}
