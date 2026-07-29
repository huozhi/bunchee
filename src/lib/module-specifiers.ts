import { statSync } from 'fs'
import path from 'path'
import { parseSync } from '@swc/core'
import { availableExtensions, tsExtensions } from '../constants'

export type CollectedSpecifiers = {
  /** Every module named by a literal specifier. */
  specifiers: string[]
  /**
   * An `import()` or `require()` whose argument is not a literal. What such a
   * call names is not knowable from the source, so a caller reasoning about
   * which modules are reached has to stop concluding.
   */
  hasComputedSpecifier: boolean
}

/** Collects into `found` whatever `node` and everything under it names. */
function walk(node: any, found: CollectedSpecifiers): void {
  if (node == null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child, found)
    return
  }

  switch (node.type) {
    // `import x from '...'`, `export * from '...'`, `export { x } from '...'`,
    // and their type-only forms. A named export with no source is a local
    // re-export and names nothing.
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration': {
      if (node.source?.type === 'StringLiteral') {
        found.specifiers.push(node.source.value)
      }
      break
    }
    // `import x = require('...')`
    case 'TsImportEqualsDeclaration': {
      const expression = node.moduleRef?.expression
      if (expression?.type === 'StringLiteral') {
        found.specifiers.push(expression.value)
      }
      break
    }
    // `import('...')` and `require('...')`, which can appear anywhere an
    // expression can — so this is why the whole tree is walked rather than just
    // the top-level statements the static forms are limited to.
    case 'CallExpression': {
      const callee = node.callee
      const isImportCall = callee?.type === 'Import'
      const isRequireCall =
        callee?.type === 'Identifier' && callee.value === 'require'
      if (isImportCall || isRequireCall) {
        const argument = node.arguments?.[0]?.expression
        if (argument?.type === 'StringLiteral') {
          found.specifiers.push(argument.value)
        } else if (argument != null) {
          found.hasComputedSpecifier = true
        }
      }
      break
    }
  }

  for (const key in node) {
    if (key === 'span') continue
    walk(node[key], found)
  }
}

/**
 * The modules `code` names, or `null` if it could not be parsed.
 *
 * Parsed rather than matched, because a specifier has to be told apart from text
 * that only looks like one: a module that generates code holds import statements
 * inside its string literals, and reading those as its own is how a file appears
 * to reach something it does not.
 *
 * A lexer that only extracts specifiers would be cheaper, but the ones available
 * answer a file they cannot handle with an empty list rather than an error —
 * indistinguishable from a file that imports nothing. Returning `null` on
 * failure is the point: a caller can tell "names nothing" from "unknown".
 */
export function collectSpecifiers(
  code: string,
  filePath: string,
): CollectedSpecifiers | null {
  const found: CollectedSpecifiers = {
    specifiers: [],
    hasComputedSpecifier: false,
  }
  const isTs = tsExtensions.has(path.extname(filePath).slice(1))
  const isJsxExtension = /\.[jt]sx$/.test(filePath)
  // `tsx` and `jsx` change how `<` is read, and the extension does not settle
  // it — a `.ts` file can hold JSX, and a generic arrow function in one parsed
  // as JSX fails. Whichever the extension suggests is tried first.
  for (const jsxEnabled of [isJsxExtension, !isJsxExtension]) {
    try {
      const ast = parseSync(code, {
        syntax: isTs ? 'typescript' : 'ecmascript',
        [isTs ? 'tsx' : 'jsx']: jsxEnabled,
      } as any)
      walk(ast.body, found)
      return found
    } catch {
      continue
    }
  }
  return null
}

function isFile(filePath: string): boolean {
  // A directory answers `existsSync`, and `'./_internal'` meaning
  // `_internal/index.ts` is exactly the case that matters — so a candidate has
  // to be a file before it counts as resolved.
  return statSync(filePath, { throwIfNoEntry: false })?.isFile() ?? false
}

/**
 * The source file `specifier`, written in `importer`, resolves to.
 *
 * `undefined` when nothing on disk answers to it, which covers both a bare
 * specifier — those name a package, not a file in the source folder — and a
 * relative one routed through something not modelled here, such as a tsconfig
 * path alias.
 *
 * The candidates cover the ways a source file is written versus imported: the
 * path as-is, with each source extension appended, as a directory index, and
 * with a declared output extension swapped back to a source one (`'./_utils.js'`
 * in TypeScript means `_utils.ts`).
 */
export function resolveSpecifierToSourceFile(
  importer: string,
  specifier: string,
): string | undefined {
  if (!specifier.startsWith('.')) return undefined

  const base = path.resolve(path.dirname(importer), specifier)
  if (isFile(base)) return base

  for (const ext of availableExtensions) {
    const withExtension = `${base}.${ext}`
    if (isFile(withExtension)) return withExtension
    const asDirectoryIndex = path.join(base, `index.${ext}`)
    if (isFile(asDirectoryIndex)) return asDirectoryIndex
  }

  const withoutJsExtension = base.replace(/\.(m|c)?js$/, '')
  if (withoutJsExtension !== base) {
    for (const ext of availableExtensions) {
      const candidate = `${withoutJsExtension}.${ext}`
      if (isFile(candidate)) return candidate
    }
  }
  return undefined
}
