// TypeScript 7+ compiles natively and its `typescript` package no longer
// ships the JS compiler API. Preload this before @swc-node/register to
// redirect its `require('typescript')` to the official @typescript/typescript6
// compat API. Scoped to @swc-node so bunchee's own TypeScript resolution
// still sees the real workspace TypeScript version.
const Module = require('module')

function hasCompilerApi() {
  try {
    return (
      typeof require('typescript').parseJsonConfigFileContent === 'function'
    )
  } catch {
    return false
  }
}

if (!hasCompilerApi()) {
  const tsApiPath = require.resolve('@typescript/typescript6')
  const originalResolveFilename = Module._resolveFilename
  Module._resolveFilename = function (request, parent, ...rest) {
    if (request === 'typescript' && parent?.filename?.includes('@swc-node')) {
      return tsApiPath
    }
    return originalResolveFilename.apply(this, [request, parent, ...rest])
  }
}
