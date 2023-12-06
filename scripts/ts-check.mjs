#!/usr/bin/env node
import * as core from '@arethetypeswrong/core'
import { groupProblemsByKind } from '@arethetypeswrong/core/utils'
import { execSync } from 'child_process'
import { readFile, stat, unlink } from 'fs/promises'
import path from 'path'

const problemFlags = {
  NoResolution: 'no-resolution',
  UntypedResolution: 'untyped-resolution',
  FalseCJS: 'false-cjs',
  FalseESM: 'false-esm',
  CJSResolvesToESM: 'cjs-resolves-to-esm',
  FallbackCondition: 'fallback-condition',
  CJSOnlyExportsDefault: 'cjs-only-exports-default',
  FalseExportDefault: 'false-export-default',
  MissingExportEquals: 'missing-export-equals',
  UnexpectedModuleSyntax: 'unexpected-module-syntax',
  InternalResolutionError: 'internal-resolution-error',
}
const fileOrDirectory = '.'

async function program() {
  var _a

  const opts = {}
  opts.ignoreRules =
    (_a = opts.ignoreRules) === null || _a === void 0
      ? void 0
      : _a.map((value) =>
          Object.keys(problemFlags).find((key) => problemFlags[key] === value),
        )


  let analysis
  let deleteTgz
  const dtIsPath =
    typeof opts.definitelyTyped === 'string' &&
    (opts.definitelyTyped.includes('/') ||
      opts.definitelyTyped.includes('\\') ||
      opts.definitelyTyped.endsWith('.tgz') ||
      opts.definitelyTyped.endsWith('.tar.gz'))

  try {
    let fileName = fileOrDirectory
    if (
      await stat(fileOrDirectory)
        .then((stat) => !stat.isFile())
        .catch(() => false)
    ) {
      if (
        !(await stat(path.join(fileOrDirectory, 'package.json')).catch(
          () => false,
        ))
      ) {
        console.error(
          `Specified directory must contain a package.json. No package.json found in ${path.resolve(
            fileOrDirectory,
          )}.`,
        )
      }

      fileName = deleteTgz = path.resolve(
        fileOrDirectory,
        execSync('npm pack', {
          cwd: fileOrDirectory,
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim(),
      )
      console.log('deleteTgz', deleteTgz)
    }
    const file = await readFile(fileName)
    const data = new Uint8Array(file)
    const pkg = dtIsPath
      ? core
          .createPackageFromTarballData(data)
          .mergedWithTypes(
            core.createPackageFromTarballData(
              new Uint8Array(await readFile(opts.definitelyTyped)),
            ),
          )
      : core.createPackageFromTarballData(data)
    analysis = await core.checkPackage(pkg, {
      entrypoints: opts.entrypoints,
      includeEntrypoints: opts.includeEntrypoints,
      excludeEntrypoints: opts.excludeEntrypoints,
    })
  } catch (error) {
    handleError(error, 'checking file')
  }

  if (opts.format === 'json') {
    const result = { analysis }
    if (analysis.types) {
      result.problems = groupProblemsByKind(analysis.problems)
    }
    console.log(JSON.stringify(result))
    if (
      analysis.types &&
      analysis.problems.some((problem) => {
        var _a
        return !((_a = opts.ignoreRules) === null || _a === void 0
          ? void 0
          : _a.includes(problem.kind))
      })
    )
      process.exit(1)
    return
  }
  console.log()
  console.log(JSON.stringify(analysis, null, 2))

  if (deleteTgz) {
    await unlink(deleteTgz)
  }
}

function handleError(error, title) {
  if (error && typeof error === 'object' && 'message' in error) {
    console.error(`error while ${title}:\n${error.message}`, {
      exitCode: 3,
      code:
        'code' in error && typeof error.code === 'string'
          ? error.code
          : 'UNKNOWN',
    })
  }
  console.error(`unknown error while ${title}`, {
    code: 'UNKNOWN',
    exitCode: 3,
  })
}
process.on('unhandledRejection', (error) => {
  handleError(error, 'checking package')
})

program().catch((error) => {
  handleError(error, 'running program')
  process.exit(0)
})
