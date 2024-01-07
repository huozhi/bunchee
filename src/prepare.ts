import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { SRC, availableExtensions } from './constants'
import { logger } from './logger'
import { baseNameWithoutExtension, hasAvailableExtension } from './utils'
import { relativify } from './lib/format'

const DIST = 'dist'

// Output with posix style in package.json
function getDistPath(...subPaths: string[]) {
  return `./${DIST}/${subPaths.join('/')}`
}

const normalizeBaseNameToExportName = (baseName: string) => {
  return baseName === 'index' ? '.' : ('./' + baseName)
}

function createExportCondition(exportName: string, moduleType?: string) {
  let cjsExtension = 'js'
  if (moduleType === 'module') {
    cjsExtension = 'cjs'
  }
  return {
    import: {
      types: getDistPath('cjs', `${exportName}.d.mts`),
      default: getDistPath('es', `${exportName}.mjs`),
    },
    require: {
      types: getDistPath('cjs', `${exportName}.d.ts`),
      default: getDistPath('es', `${exportName}.${cjsExtension}`),
    },
  }
}

export async function prepare(cwd: string): Promise<void> {
  const sourceFolder = path.resolve(cwd, SRC)
  if (!fs.existsSync(sourceFolder)) {
    logger.error(`Source folder ${sourceFolder} does not exist. Cannot proceed to configure \`exports\` field.`)
    process.exit(1)
  }

  const pkgJsonPath = path.join(cwd, 'package.json')
  let pkgJson: Record<string, any> = {}
  if (fs.existsSync(pkgJsonPath)) {
    const pkgJsonString = await fsp.readFile(pkgJsonPath, 'utf-8')
    pkgJson = JSON.parse(pkgJsonString)
  }

  // configure `files` field with `dist`
  const files = pkgJson.files || []
  if (!files.includes(DIST)) {
    files.push(DIST)
  }
  pkgJson.files = files

  // Collect bins and exports entries
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, string>()
  const entryFileDirentList = await fsp.readdir(sourceFolder, {
    withFileTypes: true,
  })
  for (const dirent of entryFileDirentList) {
    if (dirent.isDirectory()) {
      if (dirent.name === 'bin') {
        const binDirentList = await fsp.readdir(path.resolve(sourceFolder, dirent.name), {
          withFileTypes: true,
        })
        for (const binDirent of binDirentList) {
          if (binDirent.isFile()) {
            const binFile = path.join(sourceFolder, dirent.name, binDirent.name)
            const binName = baseNameWithoutExtension(binDirent.name)
            if (fs.existsSync(binFile)) {
              bins.set(binName, binFile)
            }
          }
        }
      } else {
        // Search folder/<index>.<ext> convention entries
        const extensions = availableExtensions
        for (const extension of extensions) {
          const indexFile = path.resolve(sourceFolder, dirent.name, `index.${extension}`)
          if (fs.existsSync(indexFile)) {
            exportsEntries.set(dirent.name, indexFile)
            break
          }
        }
      }
    } else if (dirent.isFile()) {
      const isAvailableExtension = availableExtensions.includes(path.extname(dirent.name).slice(1))
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
  
  if (bins.size > 0) {
    console.log('Found binaries entries:')
    for (const [binName, binFile] of bins.entries()) {
      console.log(`  ${relativify(binName)}: ${binFile}`)
    }
    if (bins.size === 1 && bins.has('.')) {
      pkgJson.bin = getDistPath('bin', 'index.js')
    } else {
      pkgJson.bin = {}
      for (const [binName] of bins.entries()) {
        pkgJson.bin[binName === '.' ? pkgJson.name : binName] = 
          getDistPath('bin', binName + '.js')
      }
    }
  }
  if (exportsEntries.size > 0) {
    console.log('Found exports entries:')
    for (const [exportName, exportFile] of exportsEntries.entries()) {
      console.log(`  ${relativify(exportName)}: ${exportFile}`)
    }
    pkgJson.exports = {}
    for (const [exportName] of exportsEntries.entries()) {
      pkgJson.exports[normalizeBaseNameToExportName(exportName)] = createExportCondition(exportName, pkgJson.type)
    }
  }

  await fsp.writeFile(pkgJsonPath, JSON.stringify(pkgJson, null, 2))
  logger.info('Configured `exports` in package.json')
  
}