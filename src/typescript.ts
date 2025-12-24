import type { CompilerOptions } from 'typescript'
import { resolve, dirname } from 'path'
import { promises as fsp } from 'fs'
import { Module } from 'module'
import pc from 'picocolors'
import { exit, fileExists } from './utils'
import { memoize } from './lib/memoize'
import { DEFAULT_TS_CONFIG } from './constants'
import { logger } from './logger'

export type TypescriptOptions = {
  tsConfigPath: string | undefined
  tsCompilerOptions: CompilerOptions | undefined
}

let hasLoggedTsWarning = false
let hasLoggedTsGoWarning = false

function resolveTsGo(cwd: string): typeof import('typescript') | null {
  let tsgo
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    // Bun does not yet support the `Module` class properly.
    if (typeof m?.require === 'undefined') {
      const tsgoPath = require.resolve('@typescript/native-preview', {
        paths: [cwd],
      })
      tsgo = require(tsgoPath)
    } else {
      tsgo = m.require('@typescript/native-preview')
    }
    // ts-go exports the TypeScript API as default or named export
    return tsgo.default || tsgo
  } catch (e) {
    if (!hasLoggedTsGoWarning) {
      hasLoggedTsGoWarning = true
      logger.warn(
        'Could not load TypeScript-Go compiler. Make sure `@typescript/native-preview` is installed as a dev dependency.',
      )
    }
    return null
  }
}

function resolveTypescript(
  cwd: string,
  useTsGo: boolean,
): typeof import('typescript') {
  if (useTsGo) {
    const tsgo = resolveTsGo(cwd)
    if (tsgo) {
      return tsgo
    }
    // Fallback to regular TypeScript if ts-go is not available
    logger.warn(
      'TypeScript-Go compiler not found, falling back to regular TypeScript compiler.',
    )
  }

  let ts
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    // Bun does not yet support the `Module` class properly.
    if (typeof m?.require === 'undefined') {
      const tsPath = require.resolve('typescript', { paths: [cwd] })
      ts = require(tsPath)
    } else {
      ts = m.require('typescript')
    }
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

export const resolveTsConfigPath = memoize(
  (
    cwd: string,
    tsconfigFileName: string | undefined = 'tsconfig.json',
  ): string | undefined => {
    let tsConfigPath: string | undefined
    tsConfigPath = resolve(cwd, tsconfigFileName)
    return fileExists(tsConfigPath) ? tsConfigPath : undefined
  },
)

function resolveTsConfigHandler(
  cwd: string,
  tsConfigPath: string | undefined,
  useTsGo: boolean,
): null | TypescriptOptions {
  let tsCompilerOptions: CompilerOptions = {}
  if (tsConfigPath) {
    // Use the original ts handler to avoid memory leak
    const ts = resolveTypescript(cwd, useTsGo)
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

// Note: We can't memoize resolveTsConfigHandler directly with useTsGo parameter
// because memoize doesn't handle optional parameters well. Instead, we'll create
// a wrapper that handles the memoization per useTsGo value.
const resolveTsConfigCache = new Map<string, TypescriptOptions | null>()

export function resolveTsConfig(
  cwd: string,
  tsConfigPath: string | undefined,
  useTsGo: boolean,
): null | TypescriptOptions {
  const cacheKey = `${cwd}:${tsConfigPath || ''}:${useTsGo ? 'tsgo' : 'ts'}`
  if (resolveTsConfigCache.has(cacheKey)) {
    return resolveTsConfigCache.get(cacheKey)!
  }
  const result = resolveTsConfigHandler(cwd, tsConfigPath, useTsGo)
  resolveTsConfigCache.set(cacheKey, result)
  return result
}

export async function convertCompilerOptions(
  cwd: string,
  json: any,
  useTsGo: boolean,
) {
  // Use the original ts handler to avoid memory leak
  const ts = resolveTypescript(cwd, useTsGo)
  return ts.convertCompilerOptionsFromJson(json, './')
}

export async function writeDefaultTsconfig(
  tsConfigPath: string,
  useTsGo: boolean,
) {
  await fsp.writeFile(
    tsConfigPath,
    JSON.stringify(DEFAULT_TS_CONFIG, null, 2),
    'utf-8',
  )
  const compilerName = useTsGo ? 'TypeScript-Go' : 'TypeScript'
  logger.log(
    `Detected using ${compilerName} but tsconfig.json is missing, created a ${pc.blue(
      'tsconfig.json',
    )} for you.`,
  )
}

export { resolveTsGo }
