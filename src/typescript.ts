import type { CompilerOptions } from 'typescript'
import { resolve, dirname } from 'path'
import { Module } from 'module'
import { exit, fileExists } from './utils'

export type TypescriptOptions = {
  tsConfigPath: string | undefined
  tsCompilerOptions: CompilerOptions
  dtsOnly: boolean
}

let hasLoggedTsWarning = false
function resolveTypescript(cwd: string): typeof import('typescript') {
  let ts
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    ts = m.require('typescript')
  } catch (_) {
    console.error(_)
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      exit(
        'Could not load TypeScript compiler. Try to install `typescript` as dev dependency'
      )
    }
  }
  return ts
}

export async function resolveTsConfig(cwd: string): Promise<null | Omit<TypescriptOptions, 'dtsOnly'>> {
  let tsCompilerOptions: CompilerOptions = {}
  let tsConfigPath: string | undefined
  const ts = resolveTypescript(cwd)
  tsConfigPath = resolve(cwd, 'tsconfig.json')
  if (await fileExists(tsConfigPath)) {
    const basePath = tsConfigPath ? dirname(tsConfigPath) : cwd
    const tsconfigJSON = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config
    tsCompilerOptions = ts.parseJsonConfigFileContent(
      tsconfigJSON,
      ts.sys,
      basePath
    ).options
  } else {
    tsConfigPath = undefined
    return null
  }
  return {
    tsCompilerOptions,
    tsConfigPath,
  }
}
