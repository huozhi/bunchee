import path from 'path'
import {
  conditionKey,
  isTypesTarget,
  parseExports,
  type OutputTarget,
} from './exports'
import { logger } from './logger'
import { PackageMetadata } from './types'
import {
  getPackageMeta,
  hasCjsExtension,
  hasPackageJson,
  isESModulePackage,
  isTypeFile,
  normalizePath,
} from './utils'
import { matchFile } from './lib/file-match'
import {
  conditionOrderRule,
  outputsExistRule,
  workspaceProtocolRule,
  type LintIssue,
} from './lint/rules'

type BadExportItem = {
  value: boolean
  paths: string[]
}

function validateTypesFieldCondition(target: OutputTarget) {
  return !isTypesTarget(target) && isTypeFile(target.path)
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
  // Not package.json detected, skip package linting
  if (!hasPackageJson(cwd)) {
    return
  }

  const pkg = await getPackageMeta(cwd)
  const { name, main, exports } = pkg
  const isESM = isESModulePackage(pkg.type)
  const parsedExports = await parseExports(pkg, cwd)
  const pkgPath = path.resolve(cwd, 'package.json')

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
    badTypesExport: OutputTarget[]
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
        parsedExports.forEach((targets) => {
          for (const target of targets) {
            if (validateTypesFieldCondition(target)) {
              exportsState.badTypesExport.push(target)
            }

            const ext = path.extname(target.path)
            if (
              target.conditions.includes('require') &&
              (ext === '.mjs' || ext === '.js')
            ) {
              exportsState.badEsmRequireExport.value = true
              exportsState.badEsmRequireExport.paths.push(target.path)
            }
            if (target.conditions.includes('import') && ext === '.cjs') {
              exportsState.badEsmImportExport.value = true
              exportsState.badEsmImportExport.paths.push(target.path)
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
        parsedExports.forEach((targets) => {
          for (const target of targets) {
            if (validateTypesFieldCondition(target)) {
              exportsState.badTypesExport.push(target)
            }
            const ext = path.extname(target.path)
            if (target.conditions.includes('require') && ext === '.mjs') {
              exportsState.badCjsRequireExport.value = true
              exportsState.badCjsRequireExport.paths.push(target.path)
            }
            if (
              target.conditions.includes('import') &&
              (ext === '.js' || ext === '.cjs')
            ) {
              exportsState.badCjsImportExport.value = true
              exportsState.badCjsImportExport.paths.push(target.path)
            }
          }
        })
      }
    }
  }

  const fieldState = validateFilesField(pkg)

  // Rules added on top of the classic checks: condition order, outputs that
  // are missing on disk, and workspace: ranges that would publish unrewritten.
  const extraIssues: LintIssue[] = [
    ...conditionOrderRule({ pkg, cwd, parsedExports, pkgPath }),
    ...outputsExistRule({ pkg, cwd, parsedExports, pkgPath }),
    ...workspaceProtocolRule({ pkg, cwd, parsedExports, pkgPath }),
  ]

  const warningsCount =
    exportsState.badTypesExport.length +
    fieldState.missingFiles.length +
    exportsState.badCjsRequireExport.paths.length +
    exportsState.badCjsImportExport.paths.length +
    exportsState.badEsmRequireExport.paths.length +
    exportsState.badEsmImportExport.paths.length +
    Number(exportsState.badMainExtension) +
    Number(exportsState.badMainExport) +
    Number(exportsState.invalidExportsFieldType) +
    extraIssues.length

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
    exportsState.badTypesExport.forEach((target) => {
      logger.error(
        `Bad export types field with ${conditionKey(target)} in ${target.path}, use "types" export condition for it`,
      )
    })
  }

  for (const issue of extraIssues) {
    logger.warn(issue.message)
  }
}
