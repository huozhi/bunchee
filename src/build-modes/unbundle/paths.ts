import { basename, isAbsolute, relative, resolve, sep } from 'path'
import type { PreRenderedChunk } from 'rollup'
import type { OutputTarget } from '../../exports'
import { specialExportConventions } from '../../constants'
import { normalizePath } from '../../utils'

export function unbundleError(name: string, message: string): Error {
  return Object.assign(new Error(message), { name })
}

function assertPublishable(file: string, dir: string): void {
  if (
    [normalizePath(dir), normalizePath(relative(dir, file))].some((part) =>
      part.split('/').includes('node_modules'),
    )
  ) {
    throw unbundleError(
      'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT',
      `Unbundle output "${file}" contains a node_modules directory. Choose a publishable output path.`,
    )
  }
}

export function claimUnbundleOutput(
  registry: Map<string, string>,
  file: string,
  moduleId: string,
  dir: string,
): void {
  assertPublishable(file, dir)
  const previous = registry.get(file)
  if (previous !== undefined && previous !== moduleId) {
    throw unbundleError(
      'BUNCHEE_UNBUNDLE_OUTPUT_CONFLICT',
      `Unbundle modules "${previous}" and "${moduleId}" both write "${file}". Rename a source file or change an exports output path.`,
    )
  }
  registry.set(file, moduleId)
}

function outsideRootError(id: string, srcRoot: string): Error {
  return unbundleError(
    'BUNCHEE_UNBUNDLE_OUTSIDE_ROOT',
    `Unbundle module "${id}" is outside source root "${srcRoot}". Move it into the package source root or externalize it as a dependency.`,
  )
}

function isInside(root: string, id: string): boolean {
  const rel = relative(root, id)
  return !(
    isAbsolute(rel) ||
    rel === '..' ||
    rel.startsWith(`..${sep}`) ||
    resolve(root, rel) !== resolve(id)
  )
}

/**
 * The publishable name of a real file: `_vendor/<pkg>/...` for dependencies,
 * a path relative to the source root otherwise. Files outside the source root
 * are an error for real modules, and fall back to a path relative to the
 * package root when they only name a virtual module.
 */
function logicalPath(
  id: string,
  srcRoot: string,
  rootDir: string | undefined,
  strict: boolean,
): string {
  const normalized = normalizePath(id)
  const vendor = normalized.lastIndexOf('/node_modules/')
  if (vendor !== -1)
    return '_vendor/' + normalized.slice(vendor + '/node_modules/'.length)
  if (isInside(srcRoot, id)) return normalizePath(relative(srcRoot, id))
  if (strict) throw outsideRootError(id, srcRoot)
  if (rootDir && isInside(rootDir, id))
    return normalizePath(relative(rootDir, id))
  return basename(id)
}

/**
 * Virtual IDs often embed the absolute path of the module they wrap
 * (`\0/abs/dep.cjs?commonjs-es-import`, `\0native-addon:/abs/addon.node`).
 * Replace that path with its logical name so output file names stay the same
 * on every machine and never leak the build directory, then flatten the rest
 * into a portable file name.
 */
function virtualName(
  moduleId: string,
  srcRoot: string,
  rootDir: string | undefined,
): string {
  const raw = moduleId.slice(1)
  const match = /^(.*?)((?:(?<![A-Za-z])[A-Za-z]:)?[\\/][^?]*)(\?.*)?$/.exec(
    raw,
  )
  const logical = match
    ? match[1] +
      logicalPath(match[2], srcRoot, rootDir, false) +
      (match[3] ?? '')
    : raw
  return '_virtual/' + logical.replace(/[\x00-\x1f<>:"/\\|?*]/g, '_')
}

export function getUnbundleOutputPath({
  moduleId,
  dir,
  srcRoot,
  rootDir,
  ext,
  suffix,
}: {
  moduleId: string
  dir: string
  srcRoot: string
  /** Package root, used only to name virtual modules wrapping outside files. */
  rootDir?: string
  ext: string
  suffix: string
}): string {
  let name = moduleId.startsWith('\0')
    ? virtualName(moduleId, srcRoot, rootDir)
    : logicalPath(moduleId.split('?')[0], srcRoot, rootDir, true)
  name = name.replace(/(?:\.d\.[cm]?ts|\.[cm]?[jt]sx?)$/, '')
  const file = resolve(dir, name + suffix + ext)
  assertPublishable(file, dir)
  return file
}

export function createUnbundleFileNames({
  dir,
  srcRoot,
  outputFilesBySource,
  rootDir,
  ext,
  suffix,
  registry,
}: {
  dir: string
  srcRoot: string
  rootDir?: string
  outputFilesBySource: Map<string, string>
  ext: string
  suffix: string
  registry: Map<string, string>
}): (chunk: PreRenderedChunk) => string {
  return (chunk) => {
    const id = chunk.facadeModuleId
    if (!id)
      throw unbundleError(
        'BUNCHEE_UNBUNDLE_UNNAMED_CHUNK',
        `Cannot name unbundle chunk "${chunk.name}" without a source module.`,
      )
    const entryFile = chunk.isEntry ? outputFilesBySource.get(id) : undefined
    const file =
      entryFile ??
      getUnbundleOutputPath({
        moduleId: id,
        dir,
        srcRoot,
        rootDir,
        ext,
        suffix,
      })
    claimUnbundleOutput(registry, file, id, dir)
    return normalizePath(relative(dir, file))
  }
}

export function getConditionSuffix(target: OutputTarget): string {
  const conditions = target.conditions.filter((name) =>
    specialExportConventions.has(name),
  )
  const filenameConditions = basename(target.path)
    .split('.')
    .filter((name) => conditions.includes(name))
  const ordered = [...new Set([...filenameConditions, ...conditions])]
  return ordered.length ? '.' + ordered.join('.') : ''
}
