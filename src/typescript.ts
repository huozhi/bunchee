import type { CompilerOptions } from 'typescript'
import { resolve, dirname } from 'path'
import { Module } from 'module'
import { exit, fileExists } from './utils'

export type TypescriptOptions = {
  tsConfigPath: string | undefined
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

export async function resolveTsConfig(
  cwd: string,
): Promise<null | TypescriptOptions> {
  let tsCompilerOptions: CompilerOptions = {}
  let tsConfigPath: string | undefined
  tsConfigPath = resolve(cwd, 'tsconfig.json')
  if (await fileExists(tsConfigPath)) {
    const ts = resolveTypescript(cwd)
    const basePath = tsConfigPath ? dirname(tsConfigPath) : cwd
    const tsconfigJSON = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config
    tsCompilerOptions = ts.parseJsonConfigFileContent(
      tsconfigJSON,
      ts.sys,
      basePath,
    ).options
  } else {
    return null
  }
  return {
    tsCompilerOptions,
    tsConfigPath,
  }
}

export async function convertCompilerOptions(cwd: string, json: any) {
  const ts = resolveTypescript(cwd)
  return ts.convertCompilerOptionsFromJson(json, './')
}
