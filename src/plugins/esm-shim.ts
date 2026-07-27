import { Plugin, ProgramNode, AstNode } from 'rollup'
import MagicString from 'magic-string'

const FILENAME_REGEX = /__filename/
const DIRNAME_REGEX = /__dirname/

const PolyfillComment = '/** rollup-private-do-not-use-esm-shim-polyfill */'
const createESMShim = ({
  filename,
  dirname,
}: {
  filename: boolean
  dirname: boolean
}) => {
  const useNodeUrl = filename || dirname
  const useNodePath = dirname
  return (
    `\
${PolyfillComment}
${useNodeUrl ? `import __node_cjsUrl from 'node:url'` : ''};
${useNodePath ? `import __node_cjsPath from 'node:path';` : ''}
${
  useNodeUrl
    ? 'const __filename = __node_cjsUrl.fileURLToPath(import.meta.url);'
    : ''
}
${useNodePath ? 'const __dirname = __node_cjsPath.dirname(__filename);' : ''}
`.trim() + '\n'
  )
}

/**
 * Defines `__filename` / `__dirname` for ESM output, where they do not exist.
 *
 * Runs on the rendered chunk rather than on each module, for two reasons: the
 * format is only known per output, so one module graph can be written as both
 * ESM and CJS with the shim landing only in the ESM one; and a chunk needs the
 * declaration once, where doing it per module left rollup to deduplicate a
 * `__filename` per module that used it.
 */
export function esmShim(): Plugin {
  return {
    name: 'esm-shim',
    renderChunk(code, _chunk, outputOptions) {
      // CJS has both bindings already. Rollup normalises `esm` to `es` here.
      if (outputOptions.format !== 'es') return null
      if (code.includes(PolyfillComment)) return null

      const hasFilename = FILENAME_REGEX.test(code)
      const hasDirname = DIRNAME_REGEX.test(code)
      if (!hasFilename && !hasDirname) return null

      const magicString = new MagicString(code)
      let ast: null | ProgramNode = null
      try {
        ast = this.parse(magicString.toString(), {
          allowReturnOutsideFunction: true,
        })
      } catch (e) {
        console.warn(e)
        return null
      }

      if (ast.type !== 'Program') return null

      // After the imports, so the shim can use them.
      let lastImportNode = null
      for (const node of ast.body) {
        if (node.type === 'ImportDeclaration') {
          lastImportNode = node
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
        '\n' + createESMShim({ filename: hasFilename, dirname: hasDirname }),
      )
      return {
        code: magicString.toString(),
        map: magicString.generateMap({ hires: true }),
      }
    },
  }
}
