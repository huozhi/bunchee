import type { OutputChunk, Plugin } from 'rollup'
import type { PackageMetadata } from '../types'
import { createRequire } from 'module'
import path from 'path'
import { logger } from '../logger'

function hasSwcHelpersDeclared(pkg: PackageMetadata): boolean {
  return Boolean(
    pkg.dependencies?.['@swc/helpers'] ||
      pkg.peerDependencies?.['@swc/helpers'] ||
      pkg.optionalDependencies?.['@swc/helpers'],
  )
}

function isSwcHelpersInstalled(cwd: string): boolean {
  try {
    // Use Node's resolver (supports pnpm/yarn PnP) and resolve from the user's project.
    const req = createRequire(path.join(cwd, 'package.json'))
    req.resolve('@swc/helpers/package.json')
    return true
  } catch {
    return false
  }
}

function chunkUsesSwcHelpers(chunk: OutputChunk): boolean {
  const allImports = chunk.imports.concat(chunk.dynamicImports)
  return allImports.some(
    (id) => id === '@swc/helpers' || id.startsWith('@swc/helpers/'),
  )
}

export function swcHelpersWarningPlugin({
  cwd,
  pkg,
}: {
  cwd: string
  pkg: PackageMetadata
}): Plugin {
  let hasWarned = false
  const swcHelpersImportFiles = new Set<string>()

  return {
    name: 'bunchee:swc-helpers-warning',
    writeBundle(options, bundle) {
      if (hasWarned) return

      const outputDir = options.dir || path.dirname(options.file!)
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type !== 'chunk') continue
        if (!chunkUsesSwcHelpers(item)) continue
        swcHelpersImportFiles.add(
          path.relative(cwd, path.join(outputDir, fileName)),
        )
      }

      if (swcHelpersImportFiles.size === 0) return
      if (isSwcHelpersInstalled(cwd)) return

      hasWarned = true
      const exampleFiles = Array.from(swcHelpersImportFiles)
        .slice(0, 3)
        .join(', ')
      const declaredHint = hasSwcHelpersDeclared(pkg)
        ? ''
        : ' (and add it to your dependencies)'

      logger.warn(
        [
          `Your build output imports "@swc/helpers" due to transform, but it isn't installed in this project.`,
          `Install it as a runtime dependency${declaredHint} (e.g. "pnpm add @swc/helpers").`,
          exampleFiles ? `Detected in: ${exampleFiles}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      )
    },
  }
}
