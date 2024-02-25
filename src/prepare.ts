import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { SRC, availableExtensions, dtsExtensionsMap } from './constants'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  hasAvailableExtension,
  isTestFile,
  isTypescriptFile,
} from './utils'
import { relativify } from './lib/format'
import { DIST } from './constants'
import { writeDefaultTsconfig } from './typescript'
import { collectSourceEntries } from './entries'

// Output with posix style in package.json
function getDistPath(...subPaths: string[]) {
  return `./${DIST}/${subPaths.join('/')}`
}

const normalizeBaseNameToExportName = (baseName: string) => {
  return /^index(\.|$)/.test(baseName) ? '.' : relativify(baseName)
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
  exportName: string,
  sourceFile: string,
  moduleType: string | undefined,
) {
  // <exportName>.<specialCondition>
  let specialCondition: Record<string, string> | undefined
  let exportCondName: string
  if (exportName.indexOf('.') > 0) {
    const [originExportName, specialConditionName] = exportName.split('.')
    specialCondition = {
      [specialConditionName]: getDistPath(
        'es',
        `${originExportName}-${specialConditionName}.mjs`,
      ),
    }
    exportCondName = normalizeBaseNameToExportName(originExportName)
    return [exportCondName, specialCondition] as const
  }
  exportCondName = normalizeBaseNameToExportName(exportName)
  const exportCond = createExportCondition(exportName, sourceFile, moduleType)

  return [exportCondName, exportCond] as const
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
      sourceFiles.forEach((sourceFile) => acc.add(sourceFile))
      return acc
    },
    new Set<string>(),
  )
  const sourceFiles: string[] = [...exportsSourceFiles, ...bins.values()].map(
    (absoluteFilePath) => baseNameWithoutExtension(absoluteFilePath),
  )
  const hasTypeScriptFiles = sourceFiles.some((filename) =>
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
        `  ${normalizeBaseNameToExportName(binName)}${spaces}: ${binFile}`,
      )
    }
    if (bins.size === 1 && bins.has('.')) {
      pkgJson.bin = getDistPath('bin', 'index.js')
    } else {
      pkgJson.bin = {}
      for (const [binName] of bins.entries()) {
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
    for (const [exportName, exportFile] of exportsEntries.entries()) {
      const spaces = ' '.repeat(
        Math.max(
          maxLengthOfExportName -
            normalizeBaseNameToExportName(exportName).length,
          0,
        ),
      )
      logger.log(
        `  ${normalizeBaseNameToExportName(
          exportName,
        )}${spaces}: ${exportFile}`,
      )
    }

    const pkgExports: Record<string, any> = {}
    for (const [exportName, sourceFiles] of exportsEntries.entries()) {
      for (const sourceFile of sourceFiles) {
        const [key, value] = createExportConditionPair(
          exportName,
          sourceFile,
          pkgJson.type,
        )
        pkgExports[key] = {
          ...value,
          ...pkgExports[key],
        }
      }
    }

    // Configure node10 module resolution
    if (exportsEntries.has('index')) {
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
