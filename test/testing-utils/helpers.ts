import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import * as debug from './debug'

export type CreateTestResultExtra = {
  dir: string
  distDir: string
  distFile: string
}

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
  const results: string[] = []
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

export async function getFileContents(dir: string, filePaths?: string[]) {
  const results: Record<string, string> = {}
  const files = filePaths || (await fsp.readdir(dir, { recursive: true }))
  for (const file of files) {
    const fullPath = path.resolve(dir, file)
    const content = await fsp.readFile(fullPath, { encoding: 'utf-8' })
    results[file] = content
  }
  return results
}

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
    return line.replace(/\s*\d+ K?B\s*/, '').trim()
  })
}

export async function deleteFile(f: string) {
  if (await existsFile(f)) {
    await fsp.unlink(f)
  }
}
