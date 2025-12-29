import path from 'path'
import { parseExports } from './exports'
import { logger } from './logger'
import { PackageMetadata } from './types'
import {
  getPackageMeta,
  hasCjsExtension,
  isESModulePackage,
  isTypeFile,
  normalizePath,
} from './utils'
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
    missingFiles: string[]
  } = {
    missingFiles: [],
  }
  const filesField = packageJson.files || ['*']
  const exportsField = packageJson.exports || {}

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
    normalizePath(path.normalize(p)),
  )
  const commonFields = ['main', 'module', 'types', 'module-sync']
  for (const field of commonFields) {
    if (field in packageJson) {
      exportedPaths.push((packageJson as any)[field])
    }
  }

  state.missingFiles = exportedPaths.filter((exportPath) => {
    // Special case for package.json
    if (exportPath === 'package.json') {
      return false
    }
    return !matchFile(filesField, exportPath)
  })

  return state
}

export async function lint(cwd: string) {
  const pkg = await getPackageMeta(cwd)
  const { name, main, exports } = pkg
  const isESM = isESModulePackage(pkg.type)
  const parsedExports = await parseExports(pkg, cwd)

  if (!name) {
    logger.warn('Missing package name')
  }

  const exportsState: {
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
          exportsState.badMainExport = true
        }
      } else if (typeof exports !== 'object') {
        exportsState.invalidExportsFieldType = true
      } else {
        parsedExports.forEach((outputPairs) => {
          for (const outputPair of outputPairs) {
            const [outputPath, composedExportType] = outputPair
            if (validateTypesFieldCondition([outputPath, composedExportType])) {
              exportsState.badTypesExport.push([outputPath, composedExportType])
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
              exportsState.badEsmRequireExport.value = true
              exportsState.badEsmRequireExport.paths.push(requirePath)
            }
            if (importExt === '.cjs') {
              exportsState.badEsmImportExport.value = true
              exportsState.badEsmImportExport.paths.push(importPath)
            }
          }
        })
      }
    }
  } else {
    // Validate CJS package
    if (main && path.extname(main) === '.mjs') {
      exportsState.badMainExtension = true
    }
    if (exports) {
      if (typeof exports === 'string') {
        if (path.extname(exports) === '.mjs') {
          exportsState.badMainExport = true
        }
      } else if (typeof exports !== 'object') {
        exportsState.invalidExportsFieldType = true
      } else {
        parsedExports.forEach((outputPairs) => {
          for (const outputPair of outputPairs) {
            const [outputPath, composedExportType] = outputPair
            if (validateTypesFieldCondition([outputPath, composedExportType])) {
              exportsState.badTypesExport.push([outputPath, composedExportType])
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
              exportsState.badCjsRequireExport.value = true
              exportsState.badCjsRequireExport.paths.push(requirePath)
            }
            if (importExt === '.js' || importExt === '.cjs') {
              exportsState.badCjsImportExport.value = true
              exportsState.badCjsImportExport.paths.push(importPath)
            }
          }
        })
      }
    }
  }

  const fieldState = validateFilesField(pkg)

  const warningsCount =
    exportsState.badTypesExport.length + fieldState.missingFiles.length

  if (warningsCount) {
    logger.warn(`Lint: ${warningsCount} issues found.`)
  }

  if (fieldState.missingFiles.length) {
    logger.warn('Missing files in package.json')
    fieldState.missingFiles.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (exportsState.badMainExtension) {
    logger.warn(
      'Cannot export `main` field with .mjs extension in CJS package, only .js extension is allowed',
    )
  }
  if (exportsState.badMainExport) {
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

  if (exportsState.invalidExportsFieldType) {
    logger.warn('Invalid exports field type, only object or string is allowed')
  }

  if (exportsState.badCjsRequireExport.value) {
    logger.warn(
      'Cannot export `require` field with .mjs extension in CJS package, only .cjs and .js extensions are allowed',
    )
    exportsState.badCjsRequireExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (exportsState.badCjsImportExport.value) {
    logger.warn(
      'Cannot export `import` field with .js or .cjs extension in CJS package, only .mjs extensions are allowed',
    )
    exportsState.badCjsImportExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (exportsState.badEsmRequireExport.value) {
    logger.warn(
      'Cannot export `require` field with .js or .mjs extension in ESM package, only .cjs extensions are allowed',
    )
    exportsState.badEsmRequireExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (exportsState.badEsmImportExport.value) {
    logger.warn(
      'Cannot export `import` field with .cjs extension in ESM package, only .js and .mjs extensions are allowed',
    )
    exportsState.badEsmImportExport.paths.forEach((p) => {
      logger.warn(`  ${p}`)
    })
  }

  if (exportsState.badTypesExport.length) {
    exportsState.badTypesExport.forEach(([outputPath, composedExportType]) => {
      logger.error(
        `Bad export types field with ${composedExportType} in ${outputPath}, use "types" export condition for it`,
      )
    })
  }
}
