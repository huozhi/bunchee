import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'

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
    const fullPath = path.join(dir, filePath)
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

  for (const [file, regex] of Object.entries(contentsRegex)) {
    const content = await fsp.readFile(path.join(dir, file), {
      encoding: 'utf-8',
    })
    if (regex instanceof RegExp) {
      expect(content).toMatch(regex)
    } else {
      expect(content).toContain(regex)
    }
  }
}

// bundle.min.js => .min.js
export const fullExtension = (filename: string) =>
  filename.slice(filename.indexOf('.'))


export function getChunkFileNamesFromLog(log: string) {
  return log.split('\n').map((line: string) => {
    return line.replace(/- \d+ K?B/, '').trim()
  })
}