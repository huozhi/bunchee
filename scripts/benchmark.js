#!/usr/bin/env node

import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import path from 'path'
import { performance } from 'perf_hooks'

const PROFILE_PREFIX = 'BUNCHEE_PROFILE '
const repositoryDir = path.resolve(import.meta.dirname, '..')
const cliPath = path.join(repositoryDir, 'dist/bin/cli.js')
const require = createRequire(import.meta.url)

function printHelp() {
  console.log(`Usage: pnpm benchmark -- [options]

Options:
  --entries <counts>     Comma-separated entry counts. Default: 1,8,57
  --iterations <count>  Measured runs per scenario. Default: 5
  --warmup <count>      Unmeasured runs per scenario. Default: 1
  --mode <modes>        Comma-separated full,no-dts. Default: full,no-dts
  --clean               Clean dist before every build. Default: false
  --json                Print the complete report as JSON
  --keep                Keep generated fixtures and print their location
  -h, --help            Show this message

The benchmark invokes dist/bin/cli.js directly. It never uses npx and does not
download packages. Run pnpm build first when invoking this script directly.`)
}

function parsePositiveInteger(value, option, { allowZero = false } = {}) {
  const parsed = Number(value)
  const minimum = allowZero ? 0 : 1
  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${option} must be an integer >= ${minimum}`)
  }
  return parsed
}

function parseList(value, option) {
  const values = value.split(',').filter(Boolean)
  if (values.length === 0) throw new Error(`${option} cannot be empty`)
  return values
}

function parseArgs(argv) {
  const options = {
    entries: [1, 8, 57],
    iterations: 5,
    warmup: 1,
    modes: ['full', 'no-dts'],
    clean: false,
    json: false,
    keep: false,
  }

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    const next = () => {
      const value = argv[++index]
      if (!value) throw new Error(`${argument} requires a value`)
      return value
    }

    switch (argument) {
      // pnpm forwards its conventional option separator to package scripts.
      case '--':
        break
      case '--entries':
        options.entries = parseList(next(), argument).map((value) =>
          parsePositiveInteger(value, argument),
        )
        break
      case '--iterations':
        options.iterations = parsePositiveInteger(next(), argument)
        break
      case '--warmup':
        options.warmup = parsePositiveInteger(next(), argument, {
          allowZero: true,
        })
        break
      case '--mode':
        options.modes = parseList(next(), argument)
        break
      case '--clean':
        options.clean = true
        break
      case '--json':
        options.json = true
        break
      case '--keep':
        options.keep = true
        break
      case '-h':
      case '--help':
        printHelp()
        process.exit(0)
      default:
        throw new Error(`Unknown option: ${argument}`)
    }
  }

  for (const mode of options.modes) {
    if (mode !== 'full' && mode !== 'no-dts') {
      throw new Error(`Unknown mode "${mode}". Use full or no-dts`)
    }
  }
  return options
}

function writeJson(file, value) {
  writeFileSync(file, JSON.stringify(value, null, 2) + '\n')
}

function createFixture(root, entryCount, mode) {
  const fixtureDir = path.join(root, `${entryCount}-${mode}`)
  const sourceDir = path.join(fixtureDir, 'src')
  mkdirSync(sourceDir, { recursive: true })

  const exports = {}
  for (let index = 0; index < entryCount; index++) {
    const name = `entry-${String(index).padStart(3, '0')}`
    exports[`./${name}`] = {
      types: `./dist/${name}/index.d.ts`,
      import: `./dist/${name}/index.mjs`,
      require: `./dist/${name}/index.js`,
    }
    writeFileSync(
      path.join(sourceDir, `${name}.ts`),
      [
        `import { sharedValue } from './_shared'`,
        `import type { Shared } from './_shared'`,
        ``,
        `export const value${index} = sharedValue + ${index}`,
        `export type Entry${index} = Shared & { index: ${index} }`,
        ``,
      ].join('\n'),
    )
  }

  writeFileSync(
    path.join(sourceDir, '_shared.ts'),
    [
      `export const sharedValue = 1`,
      `export type Shared = { shared: true }`,
      ``,
    ].join('\n'),
  )
  writeJson(path.join(fixtureDir, 'package.json'), {
    name: `bunchee-benchmark-${entryCount}`,
    private: true,
    exports,
  })
  writeJson(path.join(fixtureDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      skipLibCheck: true,
    },
    include: ['src'],
  })

  // TypeScript is a peer dependency. Link the repository's selected version so
  // generated fixtures stay offline and exercise the same compiler as Bunchee.
  const typescriptDir = path.dirname(require.resolve('typescript/package.json'))
  const fixtureNodeModules = path.join(fixtureDir, 'node_modules')
  mkdirSync(fixtureNodeModules)
  symlinkSync(
    typescriptDir,
    path.join(fixtureNodeModules, 'typescript'),
    process.platform === 'win32' ? 'junction' : 'dir',
  )

  return fixtureDir
}

function parseProfileEvents(output) {
  return output
    .split(/\r?\n/)
    .filter((line) => line.startsWith(PROFILE_PREFIX))
    .map((line) => JSON.parse(line.slice(PROFILE_PREFIX.length)))
}

function runBuild(fixtureDir, mode, clean) {
  const args = [
    cliPath,
    '--cwd',
    fixtureDir,
    '--runtime',
    'node',
    ...(clean ? [] : ['--no-clean']),
    ...(mode === 'no-dts' ? ['--no-dts'] : []),
  ]
  const started = performance.now()
  const result = spawnSync(process.execPath, args, {
    encoding: 'utf8',
    env: {
      ...process.env,
      PROFILE: '1',
      CI: '1',
      NO_COLOR: '1',
    },
    maxBuffer: 16 * 1024 * 1024,
  })
  const wallMs = performance.now() - started

  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `Bunchee exited with ${result.status}\n${result.stdout}\n${result.stderr}`,
    )
  }

  const events = parseProfileEvents(result.stdout + '\n' + result.stderr)
  if (!events.some((event) => event.phase === 'cli.total')) {
    throw new Error('Bunchee did not emit a cli.total profile event')
  }
  return { wallMs, events }
}

function getFiles(directory, base = directory) {
  if (!existsSync(directory)) return []
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...getFiles(file, base))
    else files.push(path.relative(base, file).replaceAll(path.sep, '/'))
  }
  return files.sort()
}

function validateAndHashOutput(fixtureDir, entryCount, mode) {
  const distDir = path.join(fixtureDir, 'dist')
  const files = getFiles(distDir)
  const required = ['_shared.js', '_shared.mjs']
  if (mode === 'full') required.push('_shared.d.ts', '_shared.d.mts')

  for (let index = 0; index < entryCount; index++) {
    const name = `entry-${String(index).padStart(3, '0')}`
    required.push(`${name}/index.js`, `${name}/index.mjs`)
    if (mode === 'full') required.push(`${name}/index.d.ts`)
  }

  const missing = required.filter((file) => !files.includes(file))
  if (missing.length > 0) {
    throw new Error(`Benchmark output is missing: ${missing.join(', ')}`)
  }

  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(path.join(distDir, file)))
    hash.update('\0')
  }
  return { files: files.length, sha256: hash.digest('hex') }
}

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)]
}

function phaseDuration(run, phase, kind) {
  return run.events
    .filter(
      (event) =>
        event.phase === phase &&
        (kind === undefined || event.details?.kind === kind),
    )
    .reduce((total, event) => total + event.durationMs, 0)
}

function finalEvent(run) {
  return run.events.findLast((event) => event.phase === 'cli.total')
}

function summarize(entryCount, mode, runs, output) {
  const values = (selector) => runs.map(selector)
  const wall = values((run) => run.wallMs)
  const cli = values((run) => phaseDuration(run, 'cli.total'))
  const cpu = values((run) => {
    const details = finalEvent(run)?.details
    return (details?.userCpuMs ?? 0) + (details?.systemCpuMs ?? 0)
  })
  const maxRss = values((run) => finalEvent(run)?.details?.maxRssBytes ?? 0)
  const jsGraph = values((run) => phaseDuration(run, 'rollup.graph', 'js'))
  const dtsGraph = values((run) => phaseDuration(run, 'rollup.graph', 'dts'))
  const dtsProgram = values((run) => phaseDuration(run, 'dts.program'))
  const writes = values((run) => phaseDuration(run, 'rollup.write'))

  return {
    entries: entryCount,
    mode,
    samples: runs.length,
    wallMs: {
      p50: percentile(wall, 0.5),
      p95: percentile(wall, 0.95),
      min: Math.min(...wall),
      max: Math.max(...wall),
    },
    cliMs: { p50: percentile(cli, 0.5) },
    cpuMs: { p50: percentile(cpu, 0.5) },
    maxRssBytes: Math.max(...maxRss),
    phasesMs: {
      jsGraphP50: percentile(jsGraph, 0.5),
      dtsGraphP50: percentile(dtsGraph, 0.5),
      dtsProgramP50: percentile(dtsProgram, 0.5),
      writeP50: percentile(writes, 0.5),
    },
    output,
  }
}

function round(value) {
  return Number(value.toFixed(1))
}

function printTable(report) {
  const rows = report.scenarios.map((scenario) => ({
    entries: scenario.entries,
    mode: scenario.mode,
    'wall p50': round(scenario.wallMs.p50),
    'wall p95': round(scenario.wallMs.p95),
    'cpu p50': round(scenario.cpuMs.p50),
    'JS graph': round(scenario.phasesMs.jsGraphP50),
    'DTS graph': round(scenario.phasesMs.dtsGraphP50),
    'DTS setup': round(scenario.phasesMs.dtsProgramP50),
    writes: round(scenario.phasesMs.writeP50),
    'max RSS MB': round(scenario.maxRssBytes / 1024 / 1024),
  }))
  console.table(rows)
  console.log(
    `Times are milliseconds; ${report.iterations} measured run(s) after ` +
      `${report.warmup} warmup run(s). clean=${report.clean}`,
  )
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!existsSync(cliPath)) {
    throw new Error(
      `${cliPath} does not exist. Run pnpm build before this script.`,
    )
  }

  const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'bunchee-benchmark-'))
  const scenarios = []
  try {
    for (const entryCount of options.entries) {
      for (const mode of options.modes) {
        const fixtureDir = createFixture(fixtureRoot, entryCount, mode)
        for (let index = 0; index < options.warmup; index++) {
          runBuild(fixtureDir, mode, options.clean)
        }

        const runs = []
        for (let index = 0; index < options.iterations; index++) {
          runs.push(runBuild(fixtureDir, mode, options.clean))
        }
        const output = validateAndHashOutput(fixtureDir, entryCount, mode)
        scenarios.push(summarize(entryCount, mode, runs, output))
      }
    }

    const report = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
      cli: path.relative(repositoryDir, cliPath),
      iterations: options.iterations,
      warmup: options.warmup,
      clean: options.clean,
      scenarios,
    }
    if (options.json) console.log(JSON.stringify(report, null, 2))
    else printTable(report)
  } finally {
    if (options.keep) {
      console.log(`Kept benchmark fixtures at ${fixtureRoot}`)
    } else {
      rmSync(fixtureRoot, { recursive: true, force: true })
    }
  }
}

try {
  main()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
}
