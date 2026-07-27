import { execFile } from 'child_process'
import fsp from 'fs/promises'
import path from 'path'
import * as debug from './debug'

const TEST_ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(TEST_ROOT, '..')

// Never walked, never cleaned. `node_modules` under a fixture is a checked-in
// dependency of that fixture, and `__snapshot__` holds output snapshots a test
// writes on purpose with TEST_UPDATE_SNAPSHOT.
const PRESERVED_DIRS = new Set([
  '.git',
  '__snapshot__',
  '__snapshots__',
  'node_modules',
])

// Inline snapshots live in the test file itself, so `vitest -u` writes into the
// very directory being restored.
const isTestFile = (name: string) => /\.test\.[cm]?[jt]sx?$/.test(name)

const trackedDirs = new Set<string>()

/**
 * Auto-cleanup covers the directory the test file sits in. A test file that
 * builds fixtures elsewhere — `test/compile.test.ts` drives every directory
 * under `test/compile` — declares those at module scope with this.
 */
export function trackFixtureDir(dir: string) {
  trackedDirs.add(path.resolve(dir))
}

export type FixtureSnapshot = {
  dir: string
  files: Map<string, Buffer>
  dirs: Set<string>
}

type Tree = Pick<FixtureSnapshot, 'files' | 'dirs'>

async function readTree(dir: string, rel = '', tree?: Tree): Promise<Tree> {
  const result: Tree = tree ?? { files: new Map(), dirs: new Set() }
  let entries
  try {
    entries = await fsp.readdir(path.join(dir, rel), { withFileTypes: true })
  } catch (error: any) {
    if (error.code === 'ENOENT') return result
    throw error
  }

  for (const entry of entries) {
    const relPath = rel ? path.join(rel, entry.name) : entry.name
    if (entry.isDirectory()) {
      if (PRESERVED_DIRS.has(entry.name)) continue
      result.dirs.add(relPath)
      await readTree(dir, relPath, result)
    } else if (entry.isFile() && !isTestFile(entry.name)) {
      result.files.set(relPath, await fsp.readFile(path.join(dir, relPath)))
    }
  }
  return result
}

let ignoredPaths: Promise<string[]> | undefined

/**
 * Everything under `test/` that git treats as generated: `dist` directories,
 * the tsconfig.json a build writes when a fixture has none, the package.json
 * `bunchee prepare` creates. Untracked files that are *not* ignored are left
 * alone — those are fixture files someone is still writing.
 */
function listIgnoredPaths() {
  ignoredPaths ??= new Promise<string[]>((resolve) => {
    execFile(
      'git',
      [
        'ls-files',
        '-z',
        '--others',
        '--ignored',
        '--exclude-standard',
        '--directory',
        '--',
        'test',
      ],
      { cwd: REPO_ROOT, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          debug.error(`Could not list generated test files: ${error}`)
          resolve([])
          return
        }
        resolve(
          stdout
            .split('\0')
            .filter(Boolean)
            .map((file) => path.resolve(REPO_ROOT, file)),
        )
      },
    )
  })
  return ignoredPaths
}

/**
 * Leftovers from a run that was interrupted before it could restore itself, so
 * a local run starts from the same state as a fresh checkout.
 */
async function removeStaleArtifacts(dir: string) {
  const ignored = await listIgnoredPaths()
  for (const target of ignored) {
    if (!target.startsWith(dir + path.sep)) continue
    const segments = path.relative(dir, target).split(path.sep)
    if (segments.some((segment) => PRESERVED_DIRS.has(segment))) continue
    debug.log(`Remove stale ${target}`)
    await fsp.rm(target, { recursive: true, force: true })
  }
}

export async function snapshotFixtures(testPath: string | undefined) {
  const dirs = new Set(trackedDirs)
  // A test file directly under `test/` (`compile.test.ts`) would otherwise
  // claim the whole test tree; it tracks its fixture root explicitly instead.
  if (testPath) {
    const dir = path.dirname(path.resolve(testPath))
    if (dir !== TEST_ROOT) dirs.add(dir)
  }

  const snapshots: FixtureSnapshot[] = []
  for (const dir of dirs) {
    await removeStaleArtifacts(dir)
    snapshots.push({ dir, ...(await readTree(dir)) })
  }
  return snapshots
}

export async function restoreFixtures(snapshots: FixtureSnapshot[]) {
  for (const snapshot of snapshots) {
    await restoreFixture(snapshot)
  }
}

async function restoreFixture({ dir, files, dirs }: FixtureSnapshot) {
  const current = await readTree(dir)

  // Deepest first, so a nested directory is gone before its parent is removed.
  const added = [...current.dirs]
    .filter((rel) => !dirs.has(rel))
    .sort((a, b) => b.length - a.length)
  for (const rel of added) {
    debug.log(`Clean up ${path.join(dir, rel)}`)
    await fsp.rm(path.join(dir, rel), { recursive: true, force: true })
  }

  for (const rel of current.files.keys()) {
    if (files.has(rel)) continue
    await fsp.rm(path.join(dir, rel), { force: true })
  }

  for (const rel of dirs) {
    if (current.dirs.has(rel)) continue
    await fsp.mkdir(path.join(dir, rel), { recursive: true })
  }

  // A build that rewrote a fixture file in place — `bunchee prepare` fills in
  // package.json — gets reverted to what the fixture ships.
  for (const [rel, content] of files) {
    const existing = current.files.get(rel)
    if (existing?.equals(content)) continue
    await fsp.mkdir(path.dirname(path.join(dir, rel)), { recursive: true })
    await fsp.writeFile(path.join(dir, rel), content)
  }
}
