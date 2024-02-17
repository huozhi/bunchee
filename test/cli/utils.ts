import { rm } from 'fs/promises'
import { fork } from 'child_process'
import * as debug from '../utils/debug'
import { createTest } from '../testing-utils'

type ExcuteBuncheeResult = {
  code: number
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
    ? '/../../dist/bin/cli.js'
    : '/../../src/bin/index.ts'

  const ps = fork(
    `${require.resolve('tsx/cli')}`,
    [__dirname + assetPath].concat(args),
    {
      stdio: 'pipe',
      env: options.env,
    },
  )
  let stderr = ''
  let stdout = ''
  ps.stdout?.on('data', (chunk) => (stdout += chunk.toString()))
  ps.stderr?.on('data', (chunk) => (stderr += chunk.toString()))

  if (typeof processOptions?.abortTimeout === 'number') {
    setTimeout(() => {
      ps.kill('SIGTERM')
    }, processOptions.abortTimeout)
  }

  const code = (await new Promise((resolve) => {
    ps.on('close', resolve)
  })) as number
  if (stdout) console.log(stdout)
  if (stderr) console.error(stderr)

  return { code, stdout, stderr }
}

export async function createCliTest(
  {
    args,
    options,
    abortTimeout,
    directory,
  }: {
    args?: string[]
    options?: { env?: NodeJS.ProcessEnv }
    abortTimeout?: number
    directory: string
  },
  testFn: Parameters<typeof createTest<ExcuteBuncheeResult>>[1],
): Promise<void> {
  await createTest<ExcuteBuncheeResult>(
    {
      directory,
      args: args ?? [],
      options: options ?? {},
      abortTimeout,
      run: executeBunchee,
    },
    testFn,
  )
}

export async function removeDirectory(tempDirPath: string) {
  debug.log(`Clean up ${tempDirPath}`)
  await rm(tempDirPath, { recursive: true, force: true })
}
