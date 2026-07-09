import type { CompilerOptions, Diagnostic } from '@typescript/typescript6'
import { resolve, dirname } from 'path'
import { promises as fsp } from 'fs'
import { Module } from 'module'
import pc from 'picocolors'
import { exit, fileExists } from './utils'
import { memoize } from './lib/memoize'
import { DEFAULT_TS_CONFIG } from './constants'
import { logger } from './logger'

// TypeScript 7+ compiles natively and its `typescript` package no longer ships
// the JavaScript compiler API (the main export only contains the version).
// `@typescript/typescript6` is the official package re-exporting the TS 6 API.
const TS_COMPAT_PACKAGE = '@typescript/typescript6'

type TypeScriptApi = typeof import('@typescript/typescript6')

export type TypescriptOptions = {
  tsConfigPath: string | undefined
  tsCompilerOptions: CompilerOptions | undefined
}

let hasLoggedTsWarning = false
let hasLoggedTsCompatFallback = false
let hasRedirectedTsRequire = false

// Resolve to a concrete file path (works in both Node.js and Bun); the TS 7 fallback also needs the path to redirect `require('typescript')`.
function resolveModulePath(request: string, paths: string[]): string | null {
  try {
    return require.resolve(request, { paths })
  } catch {
    return null
  }
}

function hasTsCompilerApi(ts: any): boolean {
  return (
    typeof ts?.readConfigFile === 'function' &&
    typeof ts?.parseJsonConfigFileContent === 'function'
  )
}

// Redirect `require('typescript')` to the TS 6 compat API so dependencies
// relying on the JS compiler API (e.g. rollup-plugin-dts) keep working
// when the workspace TypeScript is v7+.
function redirectTypescriptRequire(tsApiPath: string) {
  if (hasRedirectedTsRequire) return
  hasRedirectedTsRequire = true
  const moduleAny = Module as any
  const originalResolveFilename = moduleAny._resolveFilename
  moduleAny._resolveFilename = function (request: string, ...args: any[]) {
    if (request === 'typescript') {
      return tsApiPath
    }
    return originalResolveFilename.apply(this, [request, ...args])
  }
}

function resolveTypescript(cwd: string): TypeScriptApi {
  const searchPaths = (Module as any)._nodeModulePaths(cwd)
  const tsPath = resolveModulePath('typescript', searchPaths)
  let ts: any = null
  if (tsPath) {
    try {
      ts = require(tsPath)
    } catch (e) {
      console.error(e)
    }
  }
  if (!ts) {
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      exit(
        'Could not load TypeScript compiler. Try to install `typescript` as dev dependency',
      )
    }
    return ts
  }
  if (!hasTsCompilerApi(ts)) {
    const tsCompatPath =
      resolveModulePath(TS_COMPAT_PACKAGE, searchPaths) ??
      resolveModulePath(TS_COMPAT_PACKAGE, [__dirname])
    if (!tsCompatPath) {
      if (!hasLoggedTsWarning) {
        hasLoggedTsWarning = true
        exit(
          `Detected TypeScript ${ts.version || '7+'}, which no longer ships the JavaScript compiler API required for generating type declarations. Install \`${TS_COMPAT_PACKAGE}\` as dev dependency to keep building types`,
        )
      }
      return ts
    }
    redirectTypescriptRequire(tsCompatPath)
    if (!hasLoggedTsCompatFallback) {
      hasLoggedTsCompatFallback = true
      logger.log(
        pc.dim(
          `Using ${TS_COMPAT_PACKAGE} API for TypeScript ${ts.version} type declaration generation`,
        ),
      )
    }
    ts = require(tsCompatPath)
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
): null | TypescriptOptions {
  let tsCompilerOptions: CompilerOptions = {}
  if (tsConfigPath) {
    // Use the original ts handler to avoid memory leak
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

const resolveTsConfigCache = new Map<string, TypescriptOptions | null>()

export function resolveTsConfig(
  cwd: string,
  tsConfigPath: string | undefined,
): null | TypescriptOptions {
  const cacheKey = `${cwd}:${tsConfigPath || ''}`
  if (resolveTsConfigCache.has(cacheKey)) {
    return resolveTsConfigCache.get(cacheKey)!
  }
  const result = resolveTsConfigHandler(cwd, tsConfigPath)
  resolveTsConfigCache.set(cacheKey, result)
  return result
}

export async function convertCompilerOptions(
  cwd: string,
  json: any,
): Promise<{ options: CompilerOptions; errors: Diagnostic[] }> {
  // Use the original ts handler to avoid memory leak
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
