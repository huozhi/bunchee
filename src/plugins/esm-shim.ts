import { availableESExtensionsRegex } from '../constants'
import { Plugin, ProgramNode, AstNode } from 'rollup'
import { extname } from 'path'
import MagicString from 'magic-string'

const FILENAME_REGEX = /__filename/
const DIRNAME_REGEX = /__dirname/
// not char, or space before require(.resolve)?(
export const GLOBAL_REQUIRE_REGEX =
  /(?:^|[^.\w'"`])\brequire(\.resolve)?\(\s*[\r\n]*(\w|['"`])/

const PolyfillComment = '/** rollup-private-do-not-use-esm-shim-polyfill */'
const createESMShim = ({
  filename,
  dirname,
  globalRequire,
}: {
  filename: boolean
  dirname: boolean
  globalRequire: boolean
}) => {
  const useNodeUrl = filename || dirname
  const useNodePath = dirname
  const useNodeModule = globalRequire
  return (
    `\
${PolyfillComment}
${useNodeUrl ? `import __node_cjsUrl from 'node:url'` : ''};
${useNodePath ? `import __node_cjsPath from 'node:path';` : ''}
${useNodeModule ? `import __node_cjsModule from 'node:module';` : ''}
${
  useNodeUrl
    ? 'const __filename = __node_cjsUrl.fileURLToPath(import.meta.url);'
    : ''
}
${useNodePath ? 'const __dirname = __node_cjsPath.dirname(__filename);' : ''}
${
  useNodeModule
    ? 'const require = __node_cjsModule.createRequire(import.meta.url);'
    : ''
}
`.trim() + '\n'
  )
}

export function esmShim(): Plugin {
  return {
    name: 'esm-shim',
    transform: {
      order: 'post',
      handler(code, id) {
        const ext = extname(id)
        if (
          !availableESExtensionsRegex.test(ext) ||
          code.includes(PolyfillComment)
        ) {
          return null
        }

        let hasFilename = false
        let hasDirname = false
        let hasGlobalRequire = false
        if (FILENAME_REGEX.test(code)) {
          hasFilename = true
        }
        if (DIRNAME_REGEX.test(code)) {
          hasDirname = true
        }
        if (GLOBAL_REQUIRE_REGEX.test(code)) {
          hasGlobalRequire = true
        }

        if (!hasFilename && !hasDirname && !hasGlobalRequire) {
          return null
        }

        const magicString = new MagicString(code)
        let ast: null | ProgramNode = null
        try {
          // rollup 2 built-in parser doesn't have `allowShebang`, we need to use the sliced code here. Hence the `magicString.toString()`
          ast = this.parse(magicString.toString(), {
            allowReturnOutsideFunction: true,
          })
        } catch (e) {
          console.warn(e)
          return null
        }

        if (ast.type !== 'Program') {
          return null
        }

        let lastImportNode = null
        for (const node of ast.body) {
          if (node.type === 'ImportDeclaration') {
            lastImportNode = node
            continue
          }
        }
        let end: number = 0

        if (lastImportNode) {
          end = (lastImportNode as any as AstNode).end
        } else {
          end = ast.body.length > 0 ? (ast.body[0] as any as AstNode).end : 0
        }
        magicString.appendRight(
          end,
          '\n' +
            createESMShim({
              filename: hasFilename,
              dirname: hasDirname,
              globalRequire: hasGlobalRequire,
            }),
        )
        return {
          code: magicString.toString(),
          map: magicString.generateMap({ hires: true }),
        }
      },
    },
  }
}
