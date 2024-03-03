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
export const runtimeExportConventions = new Set([
  'react-server',
  'react-native',
  'edge-light',
])
export const optimizeConventions = new Set(['development', 'production'])
export const specialExportConventions = new Set([
  ...runtimeExportConventions,
  ...optimizeConventions,
])
export const availableESExtensionsRegex = /\.(m|c)?[jt]sx?$/
export const dtsExtensionRegex = /\.d\.(m|c)?ts$/

export const SRC = 'src'
export const DIST = 'dist'

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

export const DEFAULT_TS_CONFIG = {
  compilerOptions: {
    module: 'ESNext',
    moduleResolution: 'bundler',
  },
}

export const BINARY_TAG = '$binary'
