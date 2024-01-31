import type { CompilerOptions } from 'typescript'
import { resolve, dirname } from 'path'
import { promises as fsp } from 'fs'
import { Module } from 'module'
import pc from 'picocolors'
import { exit, fileExists } from './utils'
import { DEFAULT_TS_CONFIG } from './constants'
import { logger } from './logger'

export type TypescriptOptions = {
  tsConfigPath?: string
  tsCompilerOptions: CompilerOptions
}

let hasLoggedTsWarning = false
function resolveTypescript(cwd: string): typeof import('typescript') {
  let ts
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    ts = m.require('typescript')
  } catch (e) {
    console.error(e)
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      exit(
        'Could not load TypeScript compiler. Try to install `typescript` as dev dependency',
      )
    }
  }
  return ts
}

function createResolveTsConfig() {
  let options: null | TypescriptOptions = null

  return (cwd: string) => {
    let tsConfigPath: string | undefined
    tsConfigPath = resolve(cwd, 'tsconfig.json')

    // prevent test cases are read first tsconfig
    if (options && options.tsConfigPath === tsConfigPath) {
      return options
    }
    let tsCompilerOptions: CompilerOptions = {}
    if (fileExists(tsConfigPath)) {
      const ts = resolveTypescript(cwd)
      const basePath = tsConfigPath ? dirname(tsConfigPath) : cwd
      const tsconfigJSON = ts.readConfigFile(
        tsConfigPath,
        ts.sys.readFile,
      ).config
      tsCompilerOptions = ts.parseJsonConfigFileContent(
        tsconfigJSON,
        ts.sys,
        basePath,
      ).options
    } else {
      return null
    }

    options = {
      tsCompilerOptions,
      tsConfigPath,
    }
    return options
  }
}

export const resolveTsConfig = createResolveTsConfig()

export async function convertCompilerOptions(cwd: string, json: any) {
  const ts = resolveTypescript(cwd)
  return ts.convertCompilerOptionsFromJson(json, './')
}

export async function writeDefaultTsconfig(tsConfigPath: string) {
  await fsp.writeFile(
    tsConfigPath,
    JSON.stringify(DEFAULT_TS_CONFIG, null, 2),
    'utf-8',
  )
  logger.log(
    `Detected using TypeScript but tsconfig.json is missing, created a ${pc.blue(
      'tsconfig.json',
    )} for you.`,
  )
}
