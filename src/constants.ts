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
// You can find the list of runtime keys here:
// https://runtime-keys.proposal.wintercg.org/
export const runtimeExportConventions = new Set([
  'electron',
  'react-server',
  'react-native',
  'edge-light',
  'node',
  'deno',
  'bun',
  'workerd',

  // Browser only
  'browser',
])
export const runtimeExportConventionsFallback = new Map<string, string[]>([
  // ESM only runtime
  ['workerd', ['import', 'default']],
  ['edge-light', ['import', 'default']],
  // Fallback to default when unsure
  ['electron', ['default']],
  ['react-server', ['default']],
  ['react-native', ['default']],
  ['node', ['default']],
  ['deno', ['default']],
  ['bun', ['default']],
  ['development', ['default']],
  ['production', ['default']],
  ['browser', ['import', 'require', 'default']],
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
  'EMPTY_BUNDLE',
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
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'bundler',
  },
  include: ['src'],
}

export const BINARY_TAG = '$binary'

// Matches private shared modules living inside an underscore-prefixed directory,
// e.g. `_utils/index.ts`, `a/_b/c.ts`.
export const PRIVATE_GLOB_PATTERN = '**/_*/**'
// Matches underscore-prefixed files themselves, e.g. `_utils.ts`, `lib/_helper.ts`.
// PRIVATE_GLOB_PATTERN alone never matches these, since `_*` only matches a
// directory segment that has children.
const PRIVATE_FILE_GLOB_PATTERN = '**/_*'
export const PRIVATE_GLOB_PATTERNS = [
  PRIVATE_GLOB_PATTERN,
  PRIVATE_FILE_GLOB_PATTERN,
]
export const TESTS_GLOB_PATTERN =
  '**/{__tests__/**,__mocks__/**,*.{test,spec}.*}'
