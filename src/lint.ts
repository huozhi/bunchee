import path from 'path'
import { parseExports } from './exports'
import { logger } from './logger'
import { PackageMetadata } from './types'
import { hasCjsExtension, isESModulePackage, isTypeFile } from './utils'
import { matchFile } from './lib/file-match'

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

function validateFilesField(packageJson: PackageMetadata) {
  const state: {
    definedField: boolean
    missingFiles: string[]
  } = {
    definedField: false,
    missingFiles: [],
  }
  const filesField = packageJson.files || []
  const exportsField = packageJson.exports || {}

  state.definedField = !!packageJson.files

  const resolveExportsPaths = (exports: any): string[] => {
    const paths = []
    if (typeof exports === 'string') {
      paths.push(exports)
    } else if (typeof exports === 'object') {
      for (const key in exports) {
        paths.push(...resolveExportsPaths(exports[key]))
      }
    }
    return paths
  }

  const exportedPaths = resolveExportsPaths(exportsField).map((p) =>
    path.normalize(p),
  )
  const commonFields = ['main', 'module', 'types', 'module-sync']
  for (const field of commonFields) {
    if (field in packageJson) {
      exportedPaths.push((packageJson as any)[field])
    }
  }

  state.missingFiles = exportedPaths.filter((exportPath) => {
    return !matchFile(filesField, exportPath)
  })

  return state
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

  const fieldState = validateFilesField(pkg)

  if (!fieldState.definedField) {
    logger.warn('Missing files field in package.json')
  } else if (fieldState.missingFiles.length) {
    logger.warn('Missing files in package.json')
    fieldState.missingFiles.forEach((p) => {
      logger.warn(`  ${p}`)
    })
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
  }

  const warningsCount =
    state.badTypesExport.length + fieldState.missingFiles.length

  if (warningsCount) {
    logger.warn(`Found ${warningsCount} lint warnings.\n`)
  } else {
    logger.info(`Lint passed successfully.\n`)
  }
}
