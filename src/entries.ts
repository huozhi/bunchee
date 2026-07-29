import { existsSync } from 'fs'
import fsp from 'fs/promises'
import path, { posix } from 'path'
import { glob } from 'tinyglobby'
import {
  getExportTypeFromFile,
  getOutputFormat,
  getSpecialCondition,
  isTypesTarget,
  type OutputTarget,
  type ParsedExportsInfo,
} from './exports'
import { PackageMetadata, type Entries } from './types'
import { logger } from './logger'
import { baseNameWithoutExtension, validateEntryFiles } from './util/file-path'
import {
  getSourcePathFromExportPath,
  isBinExportPath,
  isESModulePackage,
  isTestFile,
  isTypescriptFile,
  resolveSourceFile,
  sourceFilenameToExportFullPath,
} from './utils'
import {
  availableExtensions,
  BINARY_TAG,
  SRC,
  runtimeExportConventions,
  specialExportConventions,
  PRIVATE_GLOB_PATTERN,
  TESTS_GLOB_PATTERN,
} from './constants'
import { posixRelativify } from './lib/format'
import {
  collectSpecifiers,
  resolveSpecifierToSourceFile,
} from './lib/module-specifiers'

export async function collectEntriesFromParsedExports(
  cwd: string,
  parsedExportsInfo: ParsedExportsInfo,
  pkg: PackageMetadata,
  sourceFile: string | undefined,
): Promise<Entries> {
  const entries: Entries = {}
  // A CLI entry file only becomes `./index` when package.json actually declares an
  // output for it. Without `-o` and without a `.` export there's no output path to
  // build to, so fall through to the export-derived entries below.
  const defaultExport = parsedExportsInfo.get('./index')?.[0]
  if (sourceFile && defaultExport) {
    const target: OutputTarget = {
      path: defaultExport.path,
      conditions: ['default'],
    }
    entries['./index'] = {
      source: sourceFile,
      name: '.',
      targets: [target],
    }
  }

  // Find source files
  const { bins, exportsEntries } = await collectSourceEntriesFromExportPaths(
    path.join(cwd, SRC),
    parsedExportsInfo,
    pkg,
  )

  // A mapping between each export path and its related special export conditions,
  // excluding the 'default' export condition.
  // { './index' => Set('development', 'edge-light') }
  const pathSpecialConditionsMap: Record<string, Set<string>> = {}
  for (const [exportPath] of exportsEntries) {
    const normalizedExportPath = stripSpecialCondition(exportPath)
    if (!pathSpecialConditionsMap[normalizedExportPath]) {
      pathSpecialConditionsMap[normalizedExportPath] = new Set()
    }

    const exportType = getExportTypeFromExportPath(exportPath)
    if (exportType !== 'default') {
      pathSpecialConditionsMap[normalizedExportPath].add(exportType)
    }
  }

  // Traverse source files and try to match the entries
  // Find exports from parsed exports info
  // entryExportPath can be: './index', './index.development', './shared.edge-light', etc.
  for (const [entryExportPath, sourceFilesMap] of exportsEntries) {
    const normalizedExportPath = stripSpecialCondition(entryExportPath)

    const entryExportPathType = getExportTypeFromExportPath(entryExportPath)
    const outputExports = parsedExportsInfo.get(normalizedExportPath)
    if (!outputExports) {
      continue
    }

    for (const target of outputExports) {
      // export type can be: default, development, react-server, etc.
      const matchedExportType = getSpecialCondition(target)
      const specialSet = pathSpecialConditionsMap[normalizedExportPath]
      const hasSpecialEntry = specialSet.has(matchedExportType)
      const sourceFile =
        sourceFilesMap[matchedExportType] || sourceFilesMap.default

      if (!sourceFile) {
        continue
      }

      if (!entries[entryExportPath]) {
        // Create a new entry
        entries[entryExportPath] = {
          source: sourceFile,
          name: normalizedExportPath,
          targets: [],
        }
      } else if (matchedExportType === entryExportPathType) {
        entries[entryExportPath].source = sourceFile
      }

      // output exports match
      if (
        matchedExportType === entryExportPathType ||
        (!hasSpecialEntry && matchedExportType !== 'default')
      ) {
        // When we dealing with special export conditions, we need to make sure
        // the outputs won't override the default export output paths.
        // e.g. We have './index' -> { default: 'index.js', development: 'index.development.js' };
        // When we generate './index.react-server' -> { 'react-server': 'index.react-server.js' },
        // Normalize the entryExportPath to './index' first and check if it already exists with output paths.
        const normalizedEntryExportPath = stripSpecialCondition(entryExportPath)
        if (
          // The entry already exists, e.g. normalize './index.react-server' to './index'
          entries[normalizedEntryExportPath] &&
          // Is special export condition
          entryExportPathType !== 'default' &&
          // The extracted special condition is not the current loop one.
          entryExportPathType !== matchedExportType
        ) {
          continue
        }
        entries[entryExportPath].targets.push(target)
      }
    }
  }

  // Handling binaries
  for (const [exportPath, sourceFile] of bins) {
    const outputExports = parsedExportsInfo.get(exportPath)
    if (!outputExports) {
      continue
    }

    for (const target of outputExports) {
      entries[exportPath] = {
        source: sourceFile,
        name: exportPath,
        targets: [target],
      }
    }
  }

  return entries
}

export async function collectBinaries(
  entries: Entries,
  pkg: PackageMetadata,
  cwd: string,
) {
  const binaryExports = pkg.bin

  if (binaryExports) {
    // binDistPaths: [ [ 'bin1', './dist/bin1.js'], [ 'bin2', './dist/bin2.js'] ]
    const binPairs =
      typeof binaryExports === 'string'
        ? [['bin', binaryExports]]
        : Object.keys(binaryExports).map((key) => [
            path.join('bin', key),
            binaryExports[key],
          ])

    const binTargets = binPairs.reduce(
      (acc, [binName, binDistPath]) => {
        acc[binName] = {
          path: binDistPath,
          conditions: [getExportTypeFromFile(binDistPath, pkg.type)],
        }
        return acc
      },
      {} as Record<string, OutputTarget>,
    )

    for (const [binName] of binPairs) {
      const source = await getSourcePathFromExportPath(cwd, binName, BINARY_TAG)

      if (!source) {
        logger.warn(`Cannot find source file for ${binName}`)
        continue
      }

      const binEntryPath = await resolveSourceFile(cwd, source)
      const target = binTargets[binName]
      entries[binName] = {
        source: binEntryPath,
        name: binName,
        targets: [target],
      }
    }
  }
}

// ./index -> default
// ./index.development -> development
// ./index.react-server -> react-server
function getExportTypeFromExportPath(exportPath: string): string {
  // Skip the first two segments: `.` and `index`
  const exportTypes = exportPath.split('.').slice(2)
  return getExportTypeFromExportTypesArray(exportTypes)
}

export function getSpecialExportTypeFromComposedExportPath(
  composedExportType: string,
): string {
  const exportTypes = composedExportType.split('.')
  for (const exportType of exportTypes) {
    if (specialExportConventions.has(exportType)) {
      return exportType
    }
  }
  return 'default'
}

export function getSpecialExportTypeFromSourcePath(sourcePath: string): string {
  const fileBaseName = baseNameWithoutExtension(sourcePath)
  return getSpecialExportTypeFromComposedExportPath(fileBaseName)
}

const ModuleFormat = {
  none: 0,
  esm: 1,
  cjs: 2,
  all: 3,
} as const

function getExportTypeFromExportTypesArray(types: string[]): string {
  let exportType = 'default'
  new Set(types).forEach((value) => {
    if (specialExportConventions.has(value)) {
      exportType = value
    } else if (value === 'import' || value === 'require' || value === 'types') {
      exportType = value
    }
  })
  return exportType
}

export function getSpecialExportTypeFromConditionNames(
  conditionNames: Set<string>,
): string {
  let exportType = 'default'
  conditionNames.forEach((value) => {
    if (specialExportConventions.has(value)) {
      exportType = value
    }
  })
  return exportType
}

// A trailing dot segment is only a condition if it actually names one.
// Anything else is part of the subpath, e.g. `./v1.2` or `./charts.min`.
const isConditionSuffix = (segment: string) =>
  specialExportConventions.has(segment) ||
  segment === 'import' ||
  segment === 'require' ||
  segment === 'types'

// ./index.react-server        -> ./index
// ./index.development.node    -> ./index
// ./v1.2/thing                -> ./v1.2/thing  (`2/thing` is not a condition)
function stripSpecialCondition(exportPath: string): string {
  let result = exportPath
  // Conditions can stack, e.g. `index.development.react-server.ts`.
  while (true) {
    const lastDot = result.lastIndexOf('.')
    // index 0 is the leading `.` of `./foo`, never a condition separator.
    if (lastDot <= 0) return result
    if (!isConditionSuffix(result.slice(lastDot + 1))) return result
    result = result.slice(0, lastDot)
  }
}

// ./index -> .
// ./index.development -> .
// ./index.react-server -> .
// ./shared -> ./shared
// ./shared.development -> ./shared
// $binary -> $binary
// $binary/index -> $binary
// $binary/foo -> $binary/foo
export function normalizeExportPath(exportPath: string): string {
  if (exportPath.startsWith(BINARY_TAG)) {
    if (exportPath === `${BINARY_TAG}/index`) {
      exportPath = BINARY_TAG
    }
    return exportPath
  }
  const baseName = stripSpecialCondition(exportPath)
  if (baseName === './index') {
    return '.'
  }
  return baseName
}

export async function collectSourceEntriesByExportPath(
  sourceFolderPath: string,
  originalSubpath: string,
  bins: Map<string, string>,
  exportsEntries: Map<string, Record<string, string>>,
) {
  const isBinaryPath = isBinExportPath(originalSubpath)
  const subpath = originalSubpath.replace(BINARY_TAG, 'bin')
  const absoluteDirPath = path.join(sourceFolderPath, subpath)
  const dirName = path.dirname(subpath) // Get directory name regardless of file/directory
  const baseName = path.basename(subpath) // Get base name regardless of file/directory
  const dirPath = path.join(sourceFolderPath, dirName)

  // Match <name>{,/index}.{<ext>,<runtime>.<ext>}
  const entryFilesPatterns = [
    `${baseName}.{${[...availableExtensions].join(',')}}`,
    `${baseName}.{${[...runtimeExportConventions].join(',')}}.{${[
      ...availableExtensions,
    ].join(',')}}`,
    `${baseName}/index.{${[...availableExtensions].join(',')}}`,
    `${baseName}/index.{${[...runtimeExportConventions].join(',')}}.{${[
      ...availableExtensions,
    ].join(',')}}`,
  ]

  const entryFiles = await glob(entryFilesPatterns, {
    cwd: dirPath,
    ignore: [PRIVATE_GLOB_PATTERN],
    expandDirectories: false,
  })

  validateEntryFiles(entryFiles)

  for (const file of entryFiles) {
    const ext = path.extname(file).slice(1)
    if (!availableExtensions.has(ext) || isTestFile(file)) continue

    const sourceFileAbsolutePath = path.join(dirPath, file)
    const exportPath = posixRelativify(
      existsSync(absoluteDirPath) &&
        (await fsp.stat(absoluteDirPath)).isDirectory()
        ? subpath
        : originalSubpath,
    )

    if (isBinaryPath) {
      bins.set(normalizeExportPath(originalSubpath), sourceFileAbsolutePath)
    } else {
      // `index.development.ts` carries a condition; `charts.min.ts` does not.
      const parts = path.basename(file).split('.')
      const filenameCondition =
        parts.length > 2 && isConditionSuffix(parts[1]) ? parts[1] : undefined
      const exportType =
        filenameCondition ?? getExportTypeFromExportPath(exportPath)
      const specialExportPath = filenameCondition
        ? exportPath + '.' + filenameCondition
        : exportPath // Adjust for direct file matches

      const sourceFilesMap = exportsEntries.get(specialExportPath) || {}
      sourceFilesMap[exportType] = sourceFileAbsolutePath

      if (specialExportConventions.has(exportType)) {
        const fallbackExportPath =
          sourceFilenameToExportFullPath(originalSubpath)
        const fallbackSourceFilesMap =
          exportsEntries.get(fallbackExportPath) || {}
        Object.assign(sourceFilesMap, fallbackSourceFilesMap)
      }

      exportsEntries.set(specialExportPath, sourceFilesMap)
    }
  }
}

/**
 * The private modules something in `src` actually imports.
 *
 * A private module exists so that bundles built separately can share it through
 * one emitted file instead of each inlining a copy. One that nothing imports
 * shares nothing, and building it is not free: a codegen script sitting in `src`
 * next to the module it generates pulls whatever it imports — a devDependency
 * the size of the TypeScript compiler, in the case this was measured against —
 * into the package's module graph and into `dist`.
 *
 * Answered by asking which private modules are referenced rather than by walking
 * the graph from the entries, so no module has to be followed to reach another.
 * That keeps a private module imported only from unreachable code, which is the
 * safe direction and much less work: any specifier naming a private module has
 * to spell its underscore-prefixed segment, so a file not containing that text
 * cannot reference it and is never parsed.
 *
 * It only ever removes a module it has positively shown to be unreferenced.
 * Everything it cannot account for is kept: a specifier that resolves to nothing
 * on disk keeps every private module whose segment it spells, since it may be a
 * tsconfig path alias or the package's own name, and a file that will not parse
 * or that computes a specifier at runtime keeps all of them.
 *
 * Runtime-condition variants of one module (`_util.js` and
 * `_util.react-server.js`) are kept as a group: the variants are alternative
 * sources for a single export path, and the one an importer means depends on the
 * condition being built, not on which file the specifier spells.
 */
export async function findReachablePrivateFiles(
  sourceFolderPath: string,
  privateFiles: string[],
  /** Every source file in `src`, relative to it. */
  sourceFiles: string[],
): Promise<Set<string>> {
  // Nothing to decide, and most packages are here: no private modules means no
  // reason to read a single source file.
  if (privateFiles.length === 0) return new Set()

  /** absolute path -> the glob-relative name, and the export path it serves. */
  const privateByPath = new Map<string, { file: string; group: string }>()
  /**
   * Text a specifier naming one of these modules has to contain.
   *
   * Every segment, not just the underscore-prefixed one: a module inside a
   * private directory is named by its siblings relatively, so `_internal/events`
   * is reached by `'./events'`, which says nothing about `_internal`.
   */
  const privateTokens = new Set<string>()
  for (const file of privateFiles) {
    privateByPath.set(path.join(sourceFolderPath, file), {
      file,
      group: stripSpecialCondition(sourceFilenameToExportFullPath(file)),
    })
    for (const segment of file.split(/[/\\]/)) {
      privateTokens.add(baseNameWithoutExtension(segment))
      // `index.react-server` is also referred to as `index`.
      privateTokens.add(segment.split('.')[0])
    }
  }

  const referencedGroups = new Set<string>()

  for (const sourceFile of sourceFiles) {
    const importer = path.join(sourceFolderPath, sourceFile)
    let code: string
    try {
      code = await fsp.readFile(importer, 'utf8')
    } catch {
      continue
    }
    // A file mentioning none of the names cannot import one of these modules,
    // and one with no `import(`/`require(` cannot be hiding a computed
    // specifier — so there is nothing in it worth parsing.
    const mightReference = [...privateTokens].some((token) =>
      code.includes(token),
    )
    const mightCompute = code.includes('import(') || code.includes('require(')
    if (!mightReference && !mightCompute) continue

    const found = collectSpecifiers(code, importer)
    if (found == null || found.hasComputedSpecifier) {
      // A file that will not parse, or one importing a path it computes at
      // runtime, could reference anything. Stop deciding rather than decide
      // wrong.
      return new Set(privateFiles)
    }

    for (const specifier of found.specifiers) {
      const resolved = resolveSpecifierToSourceFile(importer, specifier)
      if (resolved) {
        const isPrivate = privateByPath.get(resolved)
        // A private module importing itself is not a reference to it.
        if (isPrivate && resolved !== importer) {
          referencedGroups.add(isPrivate.group)
        }
        continue
      }
      // Nothing on disk answers to this specifier, so it is either external or
      // routed through something not modelled here — a tsconfig path alias, or
      // the package's own name (`swr/_internal`). Both keep the file path, so
      // keep whatever it could have meant.
      const named = new Set(
        specifier
          .split('/')
          .filter((segment) => segment.startsWith('_'))
          .map(baseNameWithoutExtension),
      )
      if (named.size === 0) continue
      for (const { file, group } of privateByPath.values()) {
        const mentioned = file
          .split(/[/\\]/)
          .some((segment) => named.has(baseNameWithoutExtension(segment)))
        if (mentioned) referencedGroups.add(group)
      }
    }
  }

  const kept = new Set<string>()
  for (const { file, group } of privateByPath.values()) {
    if (referencedGroups.has(group)) kept.add(file)
  }
  return kept
}

/**
 * exportsEntries {
 *   "./index" => {
 *      "development" => source"
 *      "react-server" => "source"
 *   },
 *  "./index.react-server" => {
 *      "development" => source"
 *      "react-server" => "source"
 *   }
 *  }
 */
export async function collectSourceEntriesFromExportPaths(
  sourceFolderPath: string,
  parsedExportsInfo: ParsedExportsInfo,
  pkg: PackageMetadata,
) {
  const bins = new Map<string, string>()
  const exportsEntries = new Map<string, Record<string, string>>()
  let requiredPrivateModuleFormats = ModuleFormat.none

  for (const [exportPath, exportInfo] of parsedExportsInfo.entries()) {
    const specialConditions = new Set<string>()
    for (const target of exportInfo) {
      // Collect required private shared module formats while walking export outputs.
      if (!isTypesTarget(target)) {
        requiredPrivateModuleFormats |=
          getOutputFormat(pkg, target) === 'cjs'
            ? ModuleFormat.cjs
            : ModuleFormat.esm
      }

      const specialExportType = getSpecialCondition(target)
      if (specialExportType !== 'default') {
        specialConditions.add(specialExportType)
      }
    }

    await collectSourceEntriesByExportPath(
      sourceFolderPath,
      exportPath,
      bins,
      exportsEntries,
    )

    for (const specialCondition of specialConditions) {
      await collectSourceEntriesByExportPath(
        sourceFolderPath,
        exportPath + '.' + specialCondition,
        bins,
        exportsEntries,
      )
    }
  }

  // Search private shared module files which are not in the parsedExportsInfo, but start with _.
  // Leading underscore: e.g. _utils.ts, _utils/index.ts
  // Segment contains leading underscore: e.g. a/_b/_c.ts, a/b/_c/index.ts
  // Contains special suffix: e.g. _utils.development.ts, _utils/index.development.js
  const suffixPattern = [...runtimeExportConventions].join(',')
  const extPattern = [...availableExtensions].join(',')
  const privatePattern = `**/_*{,/*}{,{.${suffixPattern}}}.{${extPattern}}`
  const allPrivateFiles = await glob(privatePattern, {
    cwd: sourceFolderPath,
    ignore: [TESTS_GLOB_PATTERN],
    expandDirectories: false,
  })
  // Only the ones something imports: see `findReachablePrivateFiles`. Skipped
  // entirely when the package declares no private modules, which is the common
  // case and the only reason to list the source files at all.
  const sourceFiles =
    allPrivateFiles.length > 0
      ? await glob(`**/*.{${extPattern}}`, {
          cwd: sourceFolderPath,
          ignore: [TESTS_GLOB_PATTERN],
          expandDirectories: false,
        })
      : []
  const reachablePrivateFiles = await findReachablePrivateFiles(
    sourceFolderPath,
    allPrivateFiles,
    sourceFiles,
  )
  const privateFiles = allPrivateFiles.filter((file) =>
    reachablePrivateFiles.has(file),
  )
  if (process.env.DEBUG && privateFiles.length !== allPrivateFiles.length) {
    const skipped = allPrivateFiles.filter((f) => !reachablePrivateFiles.has(f))
    logger.log(
      `Skipping ${skipped.length} private module(s) no export reaches: ${skipped.join(', ')}`,
    )
  }
  const defaultPrivateModuleFormats =
    requiredPrivateModuleFormats !== ModuleFormat.none
      ? requiredPrivateModuleFormats
      : ModuleFormat.all

  for (const file of privateFiles) {
    const sourceFileAbsolutePath = path.join(sourceFolderPath, file)
    const exportPath = sourceFilenameToExportFullPath(file)
    const isEsmPkg = isESModulePackage(pkg.type)

    const specialExportType = getSpecialExportTypeFromSourcePath(file)
    const normalizedExportPath = stripSpecialCondition(exportPath)
    const isSpecialExport = specialExportType !== 'default'

    // Special conditions prefix the composed condition, e.g.
    // `development` + `import` + `types`.
    const condPrefix = isSpecialExport ? [specialExportType] : []
    const sourceExt = path.extname(file).slice(1)
    const formats =
      sourceExt === 'cts'
        ? ModuleFormat.cjs
        : sourceExt === 'mts'
          ? ModuleFormat.esm
          : defaultPrivateModuleFormats

    // Map private shared files to the dist directory
    // e.g. ./_utils.ts -> ./dist/_utils.js
    const isTs = isTypescriptFile(file)
    const privateExportInfo: OutputTarget[] = []
    const distPath = (ext: string) =>
      posixRelativify(posix.join('./dist', exportPath + ext))

    if (formats === ModuleFormat.esm || formats === ModuleFormat.all) {
      if (isTs) {
        privateExportInfo.push({
          path: distPath(isEsmPkg ? '.d.ts' : '.d.mts'),
          conditions: [...condPrefix, 'import', 'types'],
        })
      }
      privateExportInfo.push({
        path: distPath(isEsmPkg ? '.js' : '.mjs'),
        conditions: [...condPrefix, 'import', 'default'],
      })
    }

    if (formats === ModuleFormat.cjs || formats === ModuleFormat.all) {
      if (isTs) {
        privateExportInfo.push({
          path: distPath(isEsmPkg ? '.d.cts' : '.d.ts'),
          conditions: [...condPrefix, 'require', 'types'],
        })
      }
      privateExportInfo.push({
        path: distPath(isEsmPkg ? '.cjs' : '.js'),
        conditions: [...condPrefix, 'require', 'default'],
      })
    }

    const exportsInfo = parsedExportsInfo.get(normalizedExportPath)
    if (!exportsInfo) {
      // Add private shared files to parsedExportsInfo
      parsedExportsInfo.set(normalizedExportPath, privateExportInfo)
    } else {
      // Merge private shared files to the existing exportsInfo
      exportsInfo.push(...privateExportInfo)
    }

    // Insert private shared modules into the entries
    const entry = exportsEntries.get(exportPath)
    if (!entry) {
      exportsEntries.set(exportPath, {
        [specialExportType]: sourceFileAbsolutePath,
      })
    } else {
      entry[specialExportType] = sourceFileAbsolutePath
    }
  }

  return {
    bins,
    exportsEntries,
  }
}
