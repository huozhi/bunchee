import type { PackageMetadata, ExportCondition, ExportType } from './types'
import { resolve } from 'path'
import config from './config'

export function getTypings(pkg: PackageMetadata) {
  return pkg.types || pkg.typings
}

function getDistPath(distPath: string) {
  return resolve(config.rootDir, distPath)
}

function findExport(field: any): string | undefined {
  if (!field) return
  if (typeof field === 'string') return field
  const value = field['.'] || field['import'] || field['module'] || field['default']
  return findExport(value)
}

function parseExport(exportsCondition: ExportCondition) {
  const paths: Record<Exclude<ExportType, 'default'>, string | undefined> = {}

  if (typeof exportsCondition === 'string') {
    paths.export = exportsCondition
  } else {
    paths.main = paths.main || exportsCondition['require'] || exportsCondition['node'] || exportsCondition['default']
    paths.module = paths.module || exportsCondition['module']
    paths.export = findExport(exportsCondition)
  }
  return paths
}


export function getExportPaths(pkg: PackageMetadata) {
  const pathsMap: Record<string, Record<string, string | undefined>> = {}
  const mainExport: Record<Exclude<ExportType, 'default'>, string> = {}
  if (pkg.main) {
    mainExport.main = pkg.main
  }
  if (pkg.module) {
    mainExport.module = pkg.module
  }
  pathsMap['.'] = mainExport

  const { exports: exportsConditions } = pkg
  if (exportsConditions) {
    if (typeof exportsConditions === 'string') {
      mainExport.export = exportsConditions
    } else {
      const exportKeys = Object.keys(exportsConditions)
      if (exportKeys.some((key) => key.startsWith('.'))) {
        exportKeys.forEach((subExport) => {
          pathsMap[subExport] = parseExport(exportsConditions[subExport])
        })
      } else {
        Object.assign(mainExport, parseExport(exportsConditions as ExportCondition))
      }
    }
  }
  pathsMap['.'] = mainExport

  return pathsMap
}

export function getExportDist(pkg: PackageMetadata) {
  const paths = getExportPaths(pkg)['.']
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  if (paths.main) {
    dist.push({ format: 'cjs', file: getDistPath(paths.main) })
  }
  if (paths.module) {
    dist.push({ format: 'esm', file: getDistPath(paths.module) })
  }
  if (paths.export) {
    dist.push({ format: 'esm', file: getDistPath(paths.export) })
  }

  // default fallback to output `dist/index.js` in default esm format
  if (dist.length === 0) {
    dist.push({ format: 'esm', file: getDistPath('dist/index.js') })
  }
  return dist
}

export function getExportConditionDist(pkg: PackageMetadata, exportCondition: ExportCondition) {
  // const pkgExports = pkg.exports || {}
  const dist: { format: 'cjs' | 'esm'; file: string }[] = []
  // "exports": "..."
  if (typeof exportCondition === 'string') {
    dist.push({ format: pkg.type === 'module' ? 'esm' : 'cjs', file: getDistPath(exportCondition) })
  } else {
    // "./<subexport>": { }
    const subExports = exportCondition // pkgExports[subExport]
    // Ignore json exports, like "./package.json"
    // if (subExport.endsWith('.json')) return dist
    if (typeof subExports === 'string') {
      dist.push({ format: 'esm', file: getDistPath(subExports) })
    } else {
      if (subExports.require) {
        dist.push({ format: 'cjs', file: getDistPath(subExports.require) })
      }
      if (subExports.import) {
        dist.push({ format: 'esm', file: getDistPath(subExports.import) })
      }
    }
  }
  return dist
}
