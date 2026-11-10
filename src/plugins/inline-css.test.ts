import { expect, test } from 'vitest'
import { rollup } from 'rollup'
import { inlineCss } from './inline-css'

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
