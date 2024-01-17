import path from 'path'
import { getExportPaths, isESModulePackage } from './exports'
import { logger } from './logger'
import { PackageMetadata } from './types'
import { hasCjsExtension } from './utils'

type BadExportItem = {
  value: boolean
  paths: string[]
}

export function lint(pkg: PackageMetadata) {
  const { name, main, exports } = pkg
  const isESM = isESModulePackage(pkg.type)
  const exportPaths = getExportPaths(pkg)

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
  }

  // Validate ESM package
  if (isESM) {
    if (exports) {
      if (typeof exports === 'string') {
        if (hasCjsExtension(exports)) {
          state.badMainExport = true
        }
      }
      if (typeof exports !== 'object') {
        state.invalidExportsFieldType = true
      } else {
        Object.keys(exportPaths).forEach((key) => {
          const exportConditions = exportPaths[key]
          if (typeof exportConditions === 'object') {
            const requirePath =
              // @ts-ignore TODO: fix the type
              exportConditions.require?.default ?? exportConditions.require
            const importPath =
              // @ts-ignore TODO: fix the type
              exportConditions.import?.default ?? exportConditions.import
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
    if (main && path.extname(main) === '.mjs') {
      state.badMainExtension = true
    }
    // Validate CJS package
    if (exports) {
      if (typeof exports === 'string') {
        if (!hasCjsExtension(exports)) {
          state.badMainExport = true
        }
      }
      if (typeof exports !== 'object') {
        state.invalidExportsFieldType = true
      } else {
        Object.keys(exportPaths).forEach((key) => {
          const exportConditions = exportPaths[key]
          if (typeof exportConditions === 'object') {
            const requirePath =
              // @ts-ignore TODO: fix the type
              exportConditions.require?.default ?? exportConditions.require
            const importPath =
              // @ts-ignore TODO: fix the type
              exportConditions.import?.default ?? exportConditions.import
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
    logger.warn(
      'Cannot export `exports` field with .cjs extension in ESM package, only .mjs and .js extensions are allowed',
    )
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
}
