import type { Plugin } from 'rollup'
import CleanCSS from 'clean-css'
import { type FilterPattern, createFilter } from '@rollup/pluginutils'

const helpers = {
  cssImport: {
    // Prefer a constructable stylesheet adopted by the document: it is not an
    // inline <style> element, so a Content-Security-Policy without
    // 'unsafe-inline' in style-src does not block it, and no nonce is needed.
    // replaceSync drops @import rules, so CSS using them, and environments
    // without adoptedStyleSheets, fall back to a <style> element.
    // The helper is injected after transpilation: keep it ES5.
    // have to assign r.type = 'text/css' to make it work in Safari
    global: `\
function __insertCSS(code) {
  if (!code || typeof document == 'undefined') return
  if (
    code.indexOf('@import') < 0 &&
    typeof CSSStyleSheet == 'function' &&
    'adoptedStyleSheets' in document &&
    'replaceSync' in CSSStyleSheet.prototype
  ) {
    try {
      var sheet = new CSSStyleSheet()
      sheet.replaceSync(code)
      document.adoptedStyleSheets = document.adoptedStyleSheets.concat(sheet)
      return
    } catch (e) {}
  }
  var head = document.head || document.getElementsByTagName('head')[0]
  var style = document.createElement('style')
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

/** @internal Exposed for tests. */
export const insertCssHelper = helpers.cssImport.global

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
    transform: {
      order: 'post',
      handler(code, id) {
        if (!filter(id)) return
        if (options.skip) return ''
        const cssCode = minify(code)
        cssIds.add(id)
        return {
          code: helpers.cssImport.create(cssCode),
          map: { mappings: '' },
        }
      },
    },
    renderChunk: {
      order: 'pre',
      handler(code, chunk) {
        if (!Object.keys(chunk.modules).some((id) => cssIds.has(id))) return

        return {
          code: `${helpers.cssImport.global}\n${code}`,
          map: { mappings: '' },
        }
      },
    },
  }
}
