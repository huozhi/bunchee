export const availableExtensions = [
  'js',
  'cjs',
  'mjs',
  'jsx',
  'ts',
  'tsx',
  'cts',
  'mts',
]
export const nodeResolveExtensions = ['.mjs', '.cjs', '.js', '.json', '.node', '.jsx']
export const availableExportConventions = [
  'react-server',
  'react-native',
  'edge-light',
]
export const availableESExtensionsRegex = /\.(m|c)?[jt]sx?$/
export const dtsExtensionRegex = /\.d\.(m|c)?ts$/

export const SRC = 'src'

export const dtsExtensions = {
  js: '.d.ts',
  cjs: '.d.cts',
  mjs: '.d.mts',
}

export const disabledWarnings = new Set([
  'MIXED_EXPORTS',
  'PREFER_NAMED_EXPORTS',
  'UNRESOLVED_IMPORT',
  'THIS_IS_UNDEFINED',
  'INVALID_ANNOTATION',
  'UNUSED_EXTERNAL_IMPORT',
])

export const tsExtensions = ['ts', 'tsx', 'cts', 'mts']
