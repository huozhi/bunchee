export const availableExtensions = new Set([
  'js',
  'cjs',
  'mjs',
  'jsx',
  'ts',
  'tsx',
  'cts',
  'mts',
])
export const nodeResolveExtensions = [
  '.mjs',
  '.cjs',
  '.js',
  '.json',
  '.node',
  '.jsx',
]
export const suffixedExportConventions = new Set([
  'react-server',
  'react-native',
  'edge-light',
  'development',
  'production',
])
export const availableESExtensionsRegex = /\.(m|c)?[jt]sx?$/
export const dtsExtensionRegex = /\.d\.(m|c)?ts$/

export const SRC = 'src'

export const dtsExtensionsMap = {
  js: 'd.ts',
  cjs: 'd.cts',
  mjs: 'd.mts',
}

export const disabledWarnings = new Set([
  'MIXED_EXPORTS',
  'PREFER_NAMED_EXPORTS',
  'UNRESOLVED_IMPORT',
  'THIS_IS_UNDEFINED',
  'INVALID_ANNOTATION',
  'UNUSED_EXTERNAL_IMPORT',
])

export const tsExtensions = new Set(['ts', 'tsx', 'cts', 'mts'])
