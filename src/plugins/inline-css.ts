import type { Plugin } from 'rollup'
import CleanCSS from 'clean-css'
import { type FilterPattern, createFilter } from '@rollup/pluginutils'

const helpers = {
  cssImport: {
    // have to assign r.type = 'text/css' to make it work in Safari
    global: `\
function __insertCSS(code) {
  if (!code || typeof document == 'undefined') return
  let head = document.head || document.getElementsByTagName('head')[0]
  let style = document.createElement('style')
  style.type = 'text/css'
  head.appendChild(style)
  ;style.styleSheet ? (style.styleSheet.cssText = code) : style.appendChild(document.createTextNode(code))
}
`,
    create(code: string) {
      return `__insertCSS(${JSON.stringify(code)});`
    },
  },
  cssAssertionImport: {
    global: '',
    create(code: string) {
      return `\
const sheet = new CSSStyleSheet()
sheet.replaceSync(${JSON.stringify(code)})
export default sheet`
    },
  },
} as const

const cleanCssInstance = new CleanCSS({})
function minify(code: string) {
  return cleanCssInstance.minify(code).styles
}

export function inlineCss(options: {
  skip?: boolean
  exclude?: FilterPattern
}): Plugin {
  const cssIds = new Set<string>()
  const filter = createFilter(['**/*.css'], options.exclude ?? [])
  // Follow up for rollup 4 for better support of assertion support https://github.com/rollup/rollup/issues/4818

  return {
    name: 'inline-css',
    transform(code, id) {
      if (!filter(id)) return
      if (options.skip) return ''
      const cssCode = minify(code)
      cssIds.add(id)
      return {
        code: helpers.cssImport.create(cssCode),
        map: { mappings: '' },
      }
    },
    renderChunk(code, chunk) {
      const dependenciesIds = this.getModuleIds()
      let foundCss = false
      for (const depId of dependenciesIds) {
        if (depId && cssIds.has(depId)) {
          foundCss = true
          break
        }
      }

      if (!foundCss) return

      return {
        code: `${helpers.cssImport.global}\n${code}`,
        map: { mappings: '' },
      }
    },
  }
}
