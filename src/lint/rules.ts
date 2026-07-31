import fs from 'fs'
import path from 'path'
import type { OutputTarget } from '../exports'
import type { PackageMetadata } from '../types'

export type LintContext = {
  pkg: PackageMetadata & { packageManager?: string }
  cwd: string
  parsedExports: Map<string, OutputTarget[]>
  pkgPath: string
}

export type LintIssue = {
  message: string
}

export type LintRule = (context: LintContext) => LintIssue[]

function checkConditionOrder(
  exportKey: string,
  value: Record<string, any>,
  conditionPath: string[] = [],
): string[] {
  const problems: string[] = []
  const keys = Object.keys(value)
  const location = conditionPath.length
    ? `export "${exportKey}" condition "${conditionPath.join('.')}"`
    : `export "${exportKey}"`

  const typesIndex = keys.indexOf('types')
  const defaultIndex = keys.indexOf('default')
  if (typesIndex > 0) {
    problems.push(`${location}: "types" condition should come first`)
  }
  if (defaultIndex !== -1 && defaultIndex !== keys.length - 1) {
    problems.push(`${location}: "default" condition should come last`)
  }

  for (const [condition, child] of Object.entries(value)) {
    if (child && typeof child === 'object') {
      problems.push(
        ...checkConditionOrder(exportKey, child, [...conditionPath, condition]),
      )
    }
  }
  return problems
}

/**
 * `types` must be the first condition and `default` the last one — resolvers
 * pick the first matching key, so a `default` ahead of `types` shadows the
 * declarations for TS consumers.
 */
export const conditionOrderRule: LintRule = ({ pkg }) => {
  const issues: LintIssue[] = []
  const exportsField = pkg.exports
  if (!exportsField || typeof exportsField !== 'object') {
    return issues
  }

  for (const exportKey of Object.keys(exportsField)) {
    const value = exportsField[exportKey]
    if (!value || typeof value !== 'object') {
      continue
    }
    for (const problem of checkConditionOrder(exportKey, value)) {
      issues.push({ message: problem })
    }
  }
  return issues
}

/**
 * Declared outputs that are missing on disk. Only runs when a dist directory
 * exists, so lint stays quiet on a fresh package before the first build.
 */
export const outputsExistRule: LintRule = ({ cwd, parsedExports }) => {
  if (!fs.existsSync(path.resolve(cwd, 'dist'))) {
    return []
  }
  const issues: LintIssue[] = []
  const seen = new Set<string>()
  parsedExports.forEach((targets) => {
    for (const target of targets) {
      if (seen.has(target.path) || target.path.includes('*')) {
        continue
      }
      seen.add(target.path)
      if (!fs.existsSync(path.resolve(cwd, target.path))) {
        issues.push({
          message: `Declared output does not exist on disk: ${target.path}`,
        })
      }
    }
  })
  return issues
}

/**
 * A `workspace:` range is only rewritten by pnpm publish/pack. With any other
 * package manager the literal range ships to npm and breaks installs.
 */
export const workspaceProtocolRule: LintRule = ({ pkg }) => {
  if (pkg.packageManager?.startsWith('pnpm@')) {
    return []
  }
  const depFields = [
    'dependencies',
    'peerDependencies',
    'optionalDependencies',
  ] as const
  const issues: LintIssue[] = []
  for (const field of depFields) {
    const deps = pkg[field]
    if (!deps || typeof deps !== 'object') {
      continue
    }
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        issues.push({
          message:
            `"${field}.${name}": "${range}" uses the workspace: protocol — ` +
            `publishing without pnpm will ship the literal range. ` +
            `Rewrite it before publishing.`,
        })
      }
    }
  }
  return issues
}
