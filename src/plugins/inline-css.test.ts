import { expect, test } from 'vitest'
import { rollup } from 'rollup'
import vm from 'vm'
import { inlineCss, insertCssHelper } from './inline-css'

test.each([false, true])(
  'injects the CSS helper only in chunks containing CSS (shared: %s)',
  async (shared) => {
    const modules: Record<string, string> = {
      '/a.js': "import '/style.css'; export const a = 1",
      '/b.js': `${shared ? "import '/style.css';" : ''} export const b = 2`,
      '/style.css': 'body { color: red }',
    }
    const bundle = await rollup({
      input: { a: '/a.js', b: '/b.js' },
      plugins: [
        {
          name: 'fixture',
          resolveId(id) {
            return id in modules ? id : null
          },
          load(id) {
            return modules[id]
          },
        },
        inlineCss({}),
      ],
    })
    try {
      for (const format of ['es', 'cjs'] as const) {
        const { output } = await bundle.generate({ format })
        let helperCount = 0
        for (const chunk of output) {
          if (chunk.type !== 'chunk') continue
          const containsCss = '/style.css' in chunk.modules
          expect(chunk.code.includes('function __insertCSS')).toBe(containsCss)
          if (containsCss) {
            expect(chunk.code).toContain('__insertCSS("body{color:red}")')
            helperCount++
          }
        }
        expect(helperCount).toBe(1)
      }
    } finally {
      await bundle.close()
    }
  },
)

/** Runs the injected helper against a minimal fake DOM. */
function insertCss(
  code: string,
  { constructable }: { constructable: boolean },
) {
  const styleTags: { children: string[] }[] = []
  class FakeSheet {
    text = ''
    replaceSync(text: string) {
      this.text = text
    }
  }
  const document: Record<string, any> = {
    head: {
      appendChild: (node: { children: string[] }) => styleTags.push(node),
    },
    createElement: () => ({
      children: [] as string[],
      appendChild(text: string) {
        this.children.push(text)
      },
    }),
    createTextNode: (text: string) => text,
  }
  if (constructable) document.adoptedStyleSheets = Object.freeze([])
  const context = vm.createContext({
    document,
    CSSStyleSheet: constructable ? FakeSheet : undefined,
  })
  vm.runInContext(
    `${insertCssHelper}\n__insertCSS(${JSON.stringify(code)})`,
    context,
  )
  return {
    adopted: (document.adoptedStyleSheets ?? []).map(
      (sheet: FakeSheet) => sheet.text,
    ),
    styleTags: styleTags.map((tag) => tag.children.join('')),
  }
}

test('adopts a constructable stylesheet, which CSP style-src does not block', () => {
  expect(insertCss('a{color:red}', { constructable: true })).toEqual({
    adopted: ['a{color:red}'],
    styleTags: [],
  })
})

test('falls back to a <style> element without adoptedStyleSheets', () => {
  expect(insertCss('a{color:red}', { constructable: false })).toEqual({
    adopted: [],
    styleTags: ['a{color:red}'],
  })
})

test('falls back to a <style> element for @import, which replaceSync drops', () => {
  const code = '@import url(x.css);a{color:red}'
  expect(insertCss(code, { constructable: true })).toEqual({
    adopted: [],
    styleTags: [code],
  })
})
