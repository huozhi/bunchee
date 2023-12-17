import type { Plugin, RenderedChunk } from 'rollup'
import type { Node } from 'estree'
import { extname } from 'path'
import MagicString from 'magic-string'
import { availableESExtensionsRegex } from '../constants'

interface PreserveDirectiveMeta {
  shebang: string | null,
  directives: Record<string, Set<string>>
}
const directiveRegex = /^use (\w+)$/

function preserveDirective(): Plugin {
  let hasCodeSplitting = false

  const meta: PreserveDirectiveMeta = {
    shebang: null,
    directives: new Set(),
  }

  return {
    name: 'preserve-directives',
    transform: {
      handler(code, id) {
        const ext = extname(id)
        if (!availableESExtensionsRegex.test(ext)) {
          return null
        }

        for (const node of ast.body) {
          // console.log('node', node.type)
          let directive: string | null = null;
          /**
           * rollup and estree defines `directive` field on the `ExpressionStatement` node:
           * https://github.com/rollup/rollup/blob/fecf0cfe14a9d79bb0eff4ad475174ce72775ead/src/ast/nodes/ExpressionStatement.ts#L10
           */

          if (node.type === 'ExpressionStatement') {
            if ('directive' in node) {
              directive = node.directive;
            } else if (node.expression.type === 'Literal' && typeof node.expression.value === 'string' && directiveRegex.test(node.expression.value)) {
              directive = node.expression.value
            }
          }

          if (directive && directive !== 'use strict') {
            const [, chunkName] = directiveRegex.exec(directive)!
            hasCodeSplitting = true
            console.log('split', chunkName, id)
            return `chunk-${chunkName}`
          } else {
            console.log('no split', id)
          }
        }
      }
    }
  }
}