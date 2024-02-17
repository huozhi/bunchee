import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { removeDirectory } from './cli/utils'

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
  const promises = Object.entries(contentsRegex).map(async ([file, regex]) => {
    const filePath = path.join(dir, file)
    expect({
      [filePath]: (await existsFile(filePath)) ? 'existed' : 'missing',
    }).toMatchObject({ [filePath]: 'existed' })
    const content = await fsp.readFile(filePath, {
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
