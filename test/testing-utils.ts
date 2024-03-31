import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import * as debug from './utils/debug'
import { fork } from 'child_process'

export function stripANSIColor(str: string) {
  return str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    '',
  )
}

export async function existsFile(filePath: string) {
  try {
    await fsp.access(filePath)
    return true
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return false
    }
    throw err
  }
}

export function assertContainFiles(dir: string, filePaths: string[]) {
  const results = []
  for (const filePath of filePaths) {
    const fullPath = path.resolve(dir, filePath)
    const existed = fs.existsSync(fullPath)
    if (existed) {
      results.push(filePath)
    }
  }
  expect(results).toEqual(filePaths)
}

type FunctionCondition = (content: string) => Boolean

export async function assertFilesContent(
  dir: string,
  conditionMap: Record<string, RegExp | string | FunctionCondition>,
) {
  const promises = Object.entries(conditionMap).map(
    async ([file, condition]) => {
      const filePath = path.join(dir, file)
      expect({
        [filePath]: (await existsFile(filePath)) ? 'existed' : 'missing',
      }).toMatchObject({ [filePath]: 'existed' })
      const content = await fsp.readFile(filePath, {
        encoding: 'utf-8',
      })

      if (condition instanceof RegExp) {
        expect(content).toMatch(condition)
      } else if (typeof condition === 'string') {
        expect(content).toContain(condition)
      } else if (typeof condition === 'function') {
        expect(condition(content)).toBe(true)
      }
    },
  )
  await Promise.all(promises)
}

export async function removeDirectory(tempDirPath: string) {
  debug.log(`Clean up ${tempDirPath}`)
  await fsp.rm(tempDirPath, { recursive: true, force: true })
}

// bundle.min.js => .min.js
export const fullExtension = (filename: string) =>
  filename.slice(filename.indexOf('.'))

export function getChunkFileNamesFromLog(log: string) {
  return log.split('\n').map((line: string) => {
    return line.replace(/- \d+ K?B/, '').trim()
  })
}

export async function deleteFile(f: string) {
  if (await existsFile(f)) {
    await fsp.unlink(f)
  }
}

type CreateTestResultExtra = {
  dir: string
  distDir: string
  distFile: string | null
}
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
  let distFile = null

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
    ? '../dist/bin/cli.js'
    : '../src/bin/index.ts'

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
  if (stdout) console.log(stdout)
  if (stderr) console.error(stderr)

  return { code, stdout, stderr, signal }
}
