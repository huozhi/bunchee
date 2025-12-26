import fs from 'fs'
import fsp from 'fs/promises'
import path, { posix } from 'path'
import { BINARY_TAG, SRC, dtsExtensionsMap } from '../constants'
import { logger } from '../logger'
import { isTypescriptFile } from '../utils'
import { posixRelativify } from '../lib/format'
import { DIST } from '../constants'
import { writeDefaultTsconfig } from '../typescript'
import {
  getSpecialExportTypeFromComposedExportPath,
  normalizeExportPath,
} from '../entries'
import { collectSourceEntries } from './prepare-entries'

// Output with posix style in package.json
function getDistPath(...subPaths: string[]) {
  return posixRelativify(posix.join(DIST, ...subPaths))
}

function stripeBinaryTag(exportName: string) {
  // Add \ to decode leading $
  return exportName.replace(/\$binary\//, '')
}

const normalizeBaseNameToExportName = (name: string) => {
  const baseName = stripeBinaryTag(name)
  return /^\.\/index(\.|$)/.test(baseName) ? '.' : posixRelativify(baseName)
}

function createExportCondition(
  exportName: string,
  sourceFile: string,
  moduleType: string | undefined,
  esmOnly: boolean = false,
) {
  const isTsSourceFile = isTypescriptFile(sourceFile)
  let cjsExtension: 'js' | 'cjs' = 'js'
  let esmExtension: 'js' | 'mjs' = 'mjs'
  if (moduleType === 'module') {
    cjsExtension = 'cjs'
    esmExtension = 'js'
  }
  if (exportName === '.') {
    exportName = 'index'
  }
  if (isTsSourceFile) {
    const importCondition = {
      types: getDistPath(
        'es',
        `${exportName}.${dtsExtensionsMap[esmExtension]}`,
      ),
      default: getDistPath('es', `${exportName}.${esmExtension}`),
    }
    if (esmOnly) {
      return importCondition
    }
    return {
      import: importCondition,
      require: {
        types: getDistPath(
          'cjs',
          `${exportName}.${dtsExtensionsMap[cjsExtension]}`,
        ),
        default: getDistPath('cjs', `${exportName}.${cjsExtension}`),
      },
    }
  }
  const importPath = getDistPath(`${exportName}.${esmExtension}`)
  if (esmOnly) {
    return importPath
  }
  return {
    import: importPath,
    require: getDistPath(`${exportName}.${cjsExtension}`),
  }
}

function createExportConditionPair(
  exportName: string, // <export path>.<condition>
  sourceFile: string,
  moduleType: string | undefined,
  esmOnly: boolean = false,
) {
  // <exportName>.<specialCondition>
  let specialCondition: Record<string, string> | undefined
  const specialConditionName =
    getSpecialExportTypeFromComposedExportPath(exportName)
  const normalizedExportPath = normalizeExportPath(exportName)
  if (specialConditionName !== 'default') {
    // e.g.
    // ./index.develop -> index
    // ./foo.react-server -> foo
    const fileBaseName = exportName
      .split('.')
      .slice(0, 2)
      .join('.')
      .replace('./', '')
    specialCondition = {
      [specialConditionName]: getDistPath(
        'es',
        `${fileBaseName}-${specialConditionName}.mjs`,
      ),
    }
    return [normalizedExportPath, specialCondition] as const
  }

  const exportCond = createExportCondition(
    exportName,
    sourceFile,
    moduleType,
    esmOnly,
  )
  return [normalizedExportPath, exportCond] as const
}

function detectPackageManager(cwd: string): 'pnpm' | 'npm' | 'yarn' {
  if (fs.existsSync(path.join(cwd, 'pnpm-lock.yaml'))) {
    return 'pnpm'
  }
  if (fs.existsSync(path.join(cwd, 'yarn.lock'))) {
    return 'yarn'
  }
  if (fs.existsSync(path.join(cwd, 'package-lock.json'))) {
    return 'npm'
  }
  // Default to npm if no lock file found
  return 'npm'
}

function addBuildScripts(pkgJson: Record<string, any>, cwd: string): void {
  if (!pkgJson.scripts) {
    pkgJson.scripts = {}
  }

  const packageManager = detectPackageManager(cwd)
  const buildCmd =
    packageManager === 'pnpm' ? 'pnpm build' : `${packageManager} run build`

  if (!pkgJson.scripts.build) {
    pkgJson.scripts.build = 'bunchee'
  }

  if (!pkgJson.scripts.prepublishOnly) {
    pkgJson.scripts.prepublishOnly = buildCmd
  }
}

export async function prepare(
  cwd: string,
  options?: { esm?: boolean },
): Promise<void> {
  const sourceFolder = path.resolve(cwd, SRC)
  if (!fs.existsSync(sourceFolder)) {
    logger.error(
      `Source folder ${sourceFolder} does not exist. Cannot proceed to configure \`exports\` field.`,
    )
    process.exit(1)
  }

  let hasPackageJson = false
  const pkgJsonPath = path.join(cwd, 'package.json')
  let pkgJson: Record<string, any> = {}
  if (fs.existsSync(pkgJsonPath)) {
    hasPackageJson = true
    const pkgJsonString = await fsp.readFile(pkgJsonPath, 'utf-8')
    pkgJson = JSON.parse(pkgJsonString)
  }

  // configure `files` field with `dist`
  const files = pkgJson.files || []
  if (!files.includes(DIST)) {
    files.push(DIST)
  }
  pkgJson.files = files

  let isUsingTs = false
  // Collect bins and exports entries
  const { bins, exportsEntries } = await collectSourceEntries(sourceFolder)
  const tsConfigPath = path.join(cwd, 'tsconfig.json')

  const exportsSourceFiles = [...exportsEntries.values()].reduce(
    (acc, sourceFiles) => {
      Object.values(sourceFiles).forEach((sourceFile) => acc.add(sourceFile))
      return acc
    },
    new Set<string>(),
  )
  const allSourceFiles: string[] = [
    ...exportsSourceFiles,
    ...bins.values(),
  ].map((absoluteFilePath) => absoluteFilePath)
  const hasTypeScriptFiles = allSourceFiles.some((filename) =>
    isTypescriptFile(filename),
  )
  if (hasTypeScriptFiles) {
    isUsingTs = true
    if (!fs.existsSync(tsConfigPath)) {
      await writeDefaultTsconfig(tsConfigPath, false)
    }
  }

  // Configure as ESM package by default if there's no package.json
  // OR if --esm flag is explicitly set
  if (!hasPackageJson || options?.esm) {
    pkgJson.type = 'module'
  }

  if (bins.size > 0) {
    logger.log('Discovered binaries entries:')
    const maxLengthOfBinName = Math.max(
      ...Array.from(bins.keys()).map(
        (binName) => normalizeBaseNameToExportName(binName).length,
      ),
    )
    for (const [binName, binFile] of bins.entries()) {
      const spaces = ' '.repeat(
        Math.max(
          maxLengthOfBinName - normalizeBaseNameToExportName(binName).length,
          0,
        ),
      )
      logger.log(
        `  ${normalizeBaseNameToExportName(binName)}${spaces}: ${path.basename(
          binFile,
        )}`,
      )
    }

    if (bins.size === 1 && bins.has(BINARY_TAG)) {
      pkgJson.bin = getDistPath('bin', 'index.js')
    } else {
      pkgJson.bin = {}
      for (const [binOriginName] of bins.entries()) {
        const binName = stripeBinaryTag(binOriginName)
        pkgJson.bin[binName === '.' ? pkgJson.name : binName] = getDistPath(
          'bin',
          binName + '.js',
        )
      }
    }
  }

  if (exportsEntries.size > 0) {
    logger.log('Discovered exports entries:')
    const maxLengthOfExportName = Math.max(
      ...Array.from(exportsEntries.keys()).map(
        (exportName) => normalizeBaseNameToExportName(exportName).length,
      ),
    )
    for (const [exportName, sourceFilesMap] of exportsEntries.entries()) {
      const spaces = ' '.repeat(
        Math.max(
          maxLengthOfExportName -
            normalizeBaseNameToExportName(exportName).length,
          0,
        ),
      )
      for (const exportFile of Object.values(sourceFilesMap)) {
        logger.log(
          `  ${normalizeBaseNameToExportName(
            exportName,
          )}${spaces}: ${path.basename(exportFile)}`,
        )
      }
    }

    const pkgExports: Record<string, any> = {}
    const esmOnly = options?.esm === true
    for (const [exportName, sourceFilesMap] of exportsEntries.entries()) {
      for (const sourceFile of Object.values(sourceFilesMap)) {
        const [normalizedExportPath, conditions] = createExportConditionPair(
          exportName,
          sourceFile,
          pkgJson.type,
          esmOnly,
        )
        // When esmOnly is true, conditions is either a string or an object with types/default (no import/require)
        // When esmOnly is false, conditions is an object with import/require
        if (
          esmOnly ||
          typeof conditions === 'string' ||
          (typeof conditions === 'object' &&
            conditions !== null &&
            !('import' in conditions || 'require' in conditions))
        ) {
          pkgExports[normalizedExportPath] = conditions
        } else {
          pkgExports[normalizedExportPath] = {
            ...conditions,
            ...pkgExports[normalizedExportPath],
          }
        }
      }
    }

    // Configure node10 module resolution
    if (exportsEntries.has('./index')) {
      const isESM = pkgJson.type === 'module'
      const mainExport = pkgExports['.']
      if (esmOnly) {
        // When esmOnly is true, mainExport is either a string or an object with types/default
        pkgJson.main = isUsingTs
          ? typeof mainExport === 'object'
            ? mainExport.default
            : mainExport
          : typeof mainExport === 'string'
            ? mainExport
            : mainExport.default
        pkgJson.module = isUsingTs
          ? typeof mainExport === 'object'
            ? mainExport.default
            : mainExport
          : typeof mainExport === 'string'
            ? mainExport
            : mainExport.default
        if (isUsingTs && typeof mainExport === 'object') {
          pkgJson.types = mainExport.types
        }
      } else {
        const mainCondition = isESM ? 'import' : 'require'
        pkgJson.main = isUsingTs
          ? mainExport[mainCondition].default
          : mainExport[mainCondition]

        pkgJson.module = isUsingTs
          ? mainExport.import.default
          : mainExport.import

        if (isUsingTs) {
          pkgJson.types = mainExport[mainCondition].types
        }
      }
    }

    // Assign the properties by order: files, main, module, types, exports
    if (Object.keys(pkgExports).length > 0) {
      if (!pkgJson.exports) {
        pkgJson.exports = pkgExports
      } else {
        // Update existing exports
        Object.keys(pkgExports).forEach((exportName) => {
          pkgJson.exports[exportName] = {
            // Apply the new export conditions
            ...pkgJson.exports[exportName],
            // Keep the existing export conditions
            ...pkgJson.exports[exportName],
          }
        })
      }
    }
  }

  // Additional setup when --esm flag is set
  if (options?.esm) {
    addBuildScripts(pkgJson, cwd)
  }

  await fsp.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2) + '\n')
  logger.info('Configured `exports` in package.json')
}
