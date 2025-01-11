import { fork } from 'child_process'
import { CreateTestResultExtra, removeDirectory } from './helpers'
import path from 'path'
import * as debug from './debug'

export async function createTest<T>(
  {
    args,
    options,
    directory,
    abortTimeout,
    run,
  }: {
    args: string[]
    options: { env?: NodeJS.ProcessEnv }
    directory: string
    abortTimeout?: number
    run: (
      args: string[],
      options: { env?: NodeJS.ProcessEnv },
      processOptions?: { abortTimeout?: number },
    ) => Promise<T>
  },
  testFn?: (context: T & CreateTestResultExtra) => void,
) {
  const fixturesDir = directory
  const distDir = path.join(fixturesDir, './dist')
  let distFile = ''

  if (!args.includes('--cwd')) {
    args.push('--cwd', fixturesDir)
  }
  const outputIndex = args.indexOf('-o')
  if (outputIndex !== -1) {
    distFile = path.join(fixturesDir, args[outputIndex + 1])
  }

  const result = await run(args, options, { abortTimeout })
  const build = {
    ...result,
    dir: directory,
    distDir,
    distFile,
  }
  if (testFn) {
    try {
      await testFn(build)
    } finally {
      if (!process.env.TEST_NOT_CLEANUP) {
        await removeDirectory(distDir)
      }
    }
  }
  return build
}

export function createSyncTest<T>({
  args,
  options,
  directory,
  abortTimeout,
  run,
}: {
  args: string[]
  options: { env?: NodeJS.ProcessEnv }
  directory: string
  abortTimeout?: number
  run: (
    args: string[],
    options: { env?: NodeJS.ProcessEnv },
    processOptions?: { abortTimeout?: number },
  ) => Promise<T>
}): CreateTestResultExtra & { job: T } {
  const fixturesDir = directory
  const distDir = path.join(fixturesDir, './dist')
  let distFile = ''

  if (!args.includes('--cwd')) {
    args.push('--cwd', fixturesDir)
  }
  const outputIndex = args.indexOf('-o')
  if (outputIndex !== -1) {
    distFile = path.join(fixturesDir, args[outputIndex + 1])
  }

  let result = undefined
  const resultProxy = new Proxy(
    {},
    {
      get(_, key) {
        return result?.[key] ?? null
      },
    },
  ) as any

  beforeAll(async () => {
    // execute the job
    result = await run(args, options, { abortTimeout })
  })
  afterAll(async () => {
    if (!process.env.TEST_NOT_CLEANUP) {
      await removeDirectory(distDir)
    }
  })

  return {
    get job() {
      return resultProxy
    },
    distDir,
    distFile,
    dir: directory,
  }
}

export type ExcuteBuncheeResult = {
  code: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
}

export async function executeBunchee(
  args: string[],
  options: { env?: NodeJS.ProcessEnv },
  processOptions?: { abortTimeout?: number },
): Promise<ExcuteBuncheeResult> {
  debug.log(`Command: bunchee ${args.join(' ')}`)

  const assetPath = process.env.POST_BUILD
    ? '../../dist/bin/cli.js'
    : '../../src/bin/index.ts'

  const ps = fork(path.resolve(__dirname, assetPath), args, {
    execArgv: ['-r', '@swc-node/register'],
    stdio: 'pipe',
    env: { SWC_NODE_IGNORE_DYNAMIC: 'true', ...options.env, ...process.env },
  })
  let stderr = ''
  let stdout = ''
  ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
  ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))

  if (typeof processOptions?.abortTimeout === 'number') {
    setTimeout(() => {
      ps.kill('SIGTERM')
    }, processOptions.abortTimeout)
  }

  const [code, signal] = await new Promise<
    [number | null, NodeJS.Signals | null]
  >((resolve) => {
    ps.on('close', (code, signal) => resolve([code, signal]))
  })
  if (stdout) process.stdout.write(stdout)
  if (stderr) process.stderr.write(stderr)

  return { code, stdout, stderr, signal }
}
