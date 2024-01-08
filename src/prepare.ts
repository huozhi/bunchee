import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import pc from 'picocolors'
import { SRC, availableExtensions, dtsExtensionsMap } from './constants'
import { logger } from './logger'
import {
  baseNameWithoutExtension,
  hasAvailableExtension,
  isTypescriptFile,
} from './utils'
import { relativify } from './lib/format'

const DIST = 'dist'

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
  if (moduleType === 'module') {
    cjsExtension = 'cjs'
  }
  if (isTsSourceFile) {
    return {
      import: {
        types: getDistPath('es', `${exportName}.d.mts`),
        default: getDistPath('es', `${exportName}.mjs`),
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

async function collectSourceEntries(sourceFolderPath: string) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, string>()
  const entryFileDirentList = await fsp.readdir(sourceFolderPath, {
    withFileTypes: true,
  })
  for (const dirent of entryFileDirentList) {
    if (dirent.isDirectory()) {
      if (dirent.name === 'bin') {
        const binDirentList = await fsp.readdir(
          path.join(sourceFolderPath, dirent.name),
          {
            withFileTypes: true,
          },
        )
        for (const binDirent of binDirentList) {
          if (binDirent.isFile()) {
            const binFile = path.join(
              sourceFolderPath,
              dirent.name,
              binDirent.name,
            )
            const binName = baseNameWithoutExtension(binDirent.name)
            if (fs.existsSync(binFile)) {
              bins.set(binName, binDirent.name)
            }
          }
        }
      } else {
        // Search folder/<index>.<ext> convention entries
        const extensions = availableExtensions
        for (const extension of extensions) {
          const indexFile = path.join(
            sourceFolderPath,
            dirent.name,
            `index.${extension}`,
          )
          if (fs.existsSync(indexFile)) {
            exportsEntries.set(dirent.name, indexFile)
            break
          }
        }
      }
    } else if (dirent.isFile()) {
      const isAvailableExtension = availableExtensions.includes(
        path.extname(dirent.name).slice(1),
      )
      if (isAvailableExtension) {
        const baseName = baseNameWithoutExtension(dirent.name)
        const isBinFile = baseName === 'bin'
        if (isBinFile) {
          bins.set('.', dirent.name)
        } else {
          if (hasAvailableExtension(dirent.name)) {
            exportsEntries.set(baseName, dirent.name)
          }
        }
      }
    }
  }

  return {
    bins,
    exportsEntries,
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
  const tsconfigPath = path.join(cwd, 'tsconfig.json')

  if (!fs.existsSync(tsconfigPath)) {
    const sourceFiles: string[] = [...exportsEntries.values()].concat([
      ...bins.values(),
    ])
    const hasTypeScriptFiles = sourceFiles.some((filename) =>
      isTypescriptFile(filename),
    )
    if (hasTypeScriptFiles) {
      isUsingTs = true
      await fsp.writeFile(tsconfigPath, '{}', 'utf-8')
      logger.log(
        `Detected using TypeScript but tsconfig.json is missing, created a ${pc.blue(
          'tsconfig.json',
        )} for you.`,
      )
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
    for (const [exportName, sourceFile] of exportsEntries.entries()) {
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

    // Configure node10 module resolution
    if (exportsEntries.has('index')) {
      const isESM = pkgJson.type === 'module'
      const mainExport = pkgExports['.']
      const mainCondition = isESM ? 'import' : 'require'
      pkgJson.main = isUsingTs
        ? mainExport[mainCondition].default
        : mainExport[mainCondition]
      pkgJson.module = isUsingTs
        ? mainExport.import.default
        : mainExport.import

      if (isUsingTs) {
        pkgJson.types = isESM
          ? mainExport.import.types
          : mainExport.require.types
      }
    }

    // Assign the properties by order: files, main, module, types, exports
    if (Object.keys(pkgExports).length > 0) {
      pkgJson.exports = pkgExports
    }
  }

  await fsp.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
  logger.info('Configured `exports` in package.json')
}
