import fs from 'fs'
import fsp from 'fs/promises'
import path, { posix } from 'path'
import { BINARY_TAG, SRC, dtsExtensionsMap } from './constants'
import { logger } from './logger'
import { isTypescriptFile } from './utils'
import { relativify } from './lib/format'
import { DIST } from './constants'
import { writeDefaultTsconfig } from './typescript'
import {
  collectSourceEntries,
  getSpecialExportTypeFromExportPath,
  normalizeExportPath,
} from './entries'

// Output with posix style in package.json
function getDistPath(...subPaths: string[]) {
  return relativify(posix.join(DIST, ...subPaths))
}

function stripeBinaryTag(exportName: string) {
  // Add \ to decode leading $
  return exportName.replace(/\$binary\//, '')
}

const normalizeBaseNameToExportName = (name: string) => {
  const baseName = stripeBinaryTag(name)
  return /^\.\/index(\.|$)/.test(baseName) ? '.' : relativify(baseName)
}

function createExportCondition(
  exportName: string,
  sourceFile: string,
  moduleType: string | undefined,
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
    return {
      import: {
        types: getDistPath(
          'es',
          `${exportName}.${dtsExtensionsMap[esmExtension]}`,
        ),
        default: getDistPath('es', `${exportName}.${esmExtension}`),
      },
      require: {
        types: getDistPath(
          'cjs',
          `${exportName}.${dtsExtensionsMap[cjsExtension]}`,
        ),
        default: getDistPath('cjs', `${exportName}.${cjsExtension}`),
      },
    }
  }
  return {
    import: getDistPath(`${exportName}.mjs`),
    require: getDistPath(`${exportName}.${cjsExtension}`),
  }
}

function createExportConditionPair(
  exportName: string, // <export path>.<condition>
  sourceFile: string,
  moduleType: string | undefined,
) {
  // <exportName>.<specialCondition>
  let specialCondition: Record<string, string> | undefined
  const specialConditionName = getSpecialExportTypeFromExportPath(exportName)
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

  const exportCond = createExportCondition(exportName, sourceFile, moduleType)
  return [normalizedExportPath, exportCond] as const
}

export async function prepare(cwd: string): Promise<void> {
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
      await writeDefaultTsconfig(tsConfigPath)
    }
  }

  // Configure as ESM package by default if there's no package.json
  if (!hasPackageJson) {
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
    for (const [exportName, sourceFilesMap] of exportsEntries.entries()) {
      for (const sourceFile of Object.values(sourceFilesMap)) {
        const [normalizedExportPath, conditions] = createExportConditionPair(
          exportName,
          sourceFile,
          pkgJson.type,
        )
        pkgExports[normalizedExportPath] = {
          ...conditions,
          ...pkgExports[normalizedExportPath],
        }
      }
    }

    console.log('pkgExports', pkgExports)

    // Configure node10 module resolution
    if (exportsEntries.has('./index')) {
      const isESM = pkgJson.type === 'module'
      const mainExport = pkgExports['.']
      const mainCondition = isESM ? 'import' : 'require'
      pkgJson.main = isUsingTs
        ? mainExport[mainCondition].default
        : mainExport[mainCondition]

      pkgJson.module = isUsingTs ? mainExport.import.default : mainExport.import

      if (isUsingTs) {
        pkgJson.types = mainExport[mainCondition].types
      }
    }

    // Assign the properties by order: files, main, module, types, exports
    if (Object.keys(pkgExports).length > 0) {
      if (!pkgJson.exports) {
        pkgJson.exports = pkgExports
      } else {
        // Update existing exports
        Object.keys(pkgExports).forEach((exportName) => {
          if (pkgJson.exports[exportName]) {
            pkgJson.exports[exportName] = pkgExports[exportName]
          }
        })
      }
    }
  }

  await fsp.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
  logger.info('Configured `exports` in package.json')
}
