import cp from 'child_process'
import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import * as debug from './utils/debug'

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

export async function assertFilesContent(
  dir: string,
  contentsRegex: Record<string, RegExp | string>,
) {
  const distFiles = Object.keys(contentsRegex)
  for (const relativeFile of distFiles) {
    const file = path.join(dir, relativeFile)
    expect({
      [file]: (await existsFile(file)) ? 'existed' : 'missing',
    }).toMatchObject({ [file]: 'existed' })
  }

  const promises = Object.entries(contentsRegex).map(async ([file, regex]) => {
    const content = await fsp.readFile(path.join(dir, file), {
      encoding: 'utf-8',
    })
    if (regex instanceof RegExp) {
      expect(content).toMatch(regex)
    } else {
      expect(content).toContain(regex)
    }
  })
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
  distDir: string
  distFile: string
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
  testFn: (context: T & CreateTestResultExtra) => void,
) {
  const fixturesDir = path.join(directory, './fixtures')
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
  try {
    await testFn({
      ...result,
      distDir,
      distFile,
    })
  } finally {
    await removeDirectory(distDir)
  }
}

export type ExcuteBuncheeResult = {
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
    ? '/../dist/bin/cli.js'
    : '/../src/bin/index.ts'

  const ps = cp.fork(
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
