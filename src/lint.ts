import path from 'path'
import { parseExports } from './exports'
import { logger } from './logger'
import { PackageMetadata } from './types'
import { hasCjsExtension, isESModulePackage, isTypeFile } from './utils'

type BadExportItem = {
  value: boolean
  paths: string[]
}

function validateTypesFieldCondition(pair: [string, string]) {
  const [outputPath, composedExportType] = pair
  const exportTypes = new Set(composedExportType.split('.'))

  if (!exportTypes.has('types') && isTypeFile(outputPath)) {
    return true
  }
  return false
}

export function lint(pkg: PackageMetadata) {
  const { name, main, exports } = pkg
  const isESM = isESModulePackage(pkg.type)
  const parsedExports = parseExports(pkg)

  if (!name) {
    logger.warn('Missing package name')
  }

  const state: {
    badMainExtension: boolean
    badMainExport: boolean
    invalidExportsFieldType: boolean
    badCjsRequireExport: BadExportItem
    badCjsImportExport: BadExportItem
    badEsmRequireExport: BadExportItem
    badEsmImportExport: BadExportItem
    badTypesExport: [string, string][]
  } = {
    badMainExtension: false,
    badMainExport: false,
    invalidExportsFieldType: false,
    badCjsRequireExport: {
      value: false,
      paths: [],
    },
    badCjsImportExport: {
      value: false,
      paths: [],
    },
    badEsmRequireExport: {
      value: false,
      paths: [],
    },
    badEsmImportExport: {
      value: false,
      paths: [],
    },
    badTypesExport: [],
  }

  // Validate ESM package
  if (isESM) {
    if (exports) {
      if (typeof exports === 'string') {
        if (hasCjsExtension(exports)) {
          state.badMainExport = true
        }
      } else if (typeof exports !== 'object') {
        state.invalidExportsFieldType = true
      } else {
        parsedExports.forEach((outputPairs) => {
          for (const outputPair of outputPairs) {
            const [outputPath, composedExportType] = outputPair
            if (validateTypesFieldCondition([outputPath, composedExportType])) {
              state.badTypesExport.push([outputPath, composedExportType])
            }

            const exportTypes = new Set(composedExportType.split('.'))
            let requirePath: string = ''
            let importPath: string = ''
            if (exportTypes.has('require')) {
              requirePath = outputPath
            }
            if (exportTypes.has('import')) {
              importPath = outputPath
            }
            const requireExt = requirePath && path.extname(requirePath)
            const importExt = importPath && path.extname(importPath)
            if (requireExt === '.mjs' || requireExt === '.js') {
              state.badEsmRequireExport.value = true
              state.badEsmRequireExport.paths.push(requirePath)
            }
            if (importExt === '.cjs') {
              state.badEsmImportExport.value = true
              state.badEsmImportExport.paths.push(importPath)
            }
          }
        })
      }
    }
  } else {
    // Validate CJS package
    if (main && path.extname(main) === '.mjs') {
      state.badMainExtension = true
    }
    if (exports) {
      if (typeof exports === 'string') {
        if (path.extname(exports) === '.mjs') {
          state.badMainExport = true
        }
      } else if (typeof exports !== 'object') {
        state.invalidExportsFieldType = true
      } else {
        parsedExports.forEach((outputPairs) => {
          for (const outputPair of outputPairs) {
            const [outputPath, composedExportType] = outputPair
            if (validateTypesFieldCondition([outputPath, composedExportType])) {
              state.badTypesExport.push([outputPath, composedExportType])
            }
            const exportTypes = new Set(composedExportType.split('.'))
            let requirePath: string = ''
            let importPath: string = ''
            if (exportTypes.has('require')) {
              requirePath = outputPath
            }
            if (exportTypes.has('import')) {
              importPath = outputPath
            }
            const requireExt = requirePath && path.extname(requirePath)
            const importExt = importPath && path.extname(importPath)
            if (requireExt === '.mjs') {
              state.badCjsRequireExport.value = true
              state.badCjsRequireExport.paths.push(requirePath)
            }
            if (importExt === '.js' || importExt === '.cjs') {
              state.badCjsImportExport.value = true
              state.badCjsImportExport.paths.push(importPath)
            }
          }
        })
      }
    }
  }

  if (state.badMainExtension) {
    logger.warn(
      'Cannot export `main` field with .mjs extension in CJS package, only .js extension is allowed',
    )
  }
  if (state.badMainExport) {
    if (isESM) {
      logger.warn(
        'Cannot export `exports` field with .cjs extension in ESM package, only .mjs and .js extensions are allowed',
      )
    } else {
      logger.warn(
        'Cannot export `exports` field with .mjs extension in CJS package, only .js and .cjs extensions are allowed',
      )
    }
  }

  if (state.invalidExportsFieldType) {
    logger.warn('Invalid exports field type, only object or string is allowed')
  }

  if (state.badCjsRequireExport.value) {
    logger.warn(
      'Cannot export `require` field with .mjs extension in CJS package, only .cjs and .js extensions are allowed',
    )
    state.badCjsRequireExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (state.badCjsImportExport.value) {
    logger.warn(
      'Cannot export `import` field with .js or .cjs extension in CJS package, only .mjs extensions are allowed',
    )
    state.badCjsImportExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (state.badEsmRequireExport.value) {
    logger.warn(
      'Cannot export `require` field with .js or .mjs extension in ESM package, only .cjs extensions are allowed',
    )
    state.badEsmRequireExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (state.badEsmImportExport.value) {
    logger.warn(
      'Cannot export `import` field with .cjs extension in ESM package, only .js and .mjs extensions are allowed',
    )
    state.badEsmImportExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (state.badTypesExport.length) {
    state.badTypesExport.forEach(([outputPath, composedExportType]) => {
      logger.error(
        `Bad export types field with ${composedExportType} in ${outputPath}, use "types" export condition for it`,
      )
    })
    process.exit(1)
  }
}
